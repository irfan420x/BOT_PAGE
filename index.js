/**
 * index.js (serverless entry)
 *
 * This file exposes an Express application configured to handle Facebook
 * Messenger webhooks, serve a simple dashboard and load bot plugins. It
 * never calls `app.listen()` so that it can be deployed to serverless
 * platforms such as Vercel. For traditional server environments use
 * `server.js` to start the HTTP listener.
 *
 * The application is engineered to be fault tolerant: missing or invalid
 * configuration files, absent tokens, failed plugin loads or runtime
 * exceptions will not crash the server. Detailed logs are emitted to aid
 * debugging.
 */

const express = require('express');
const bodyParser = require('body-parser');
// Removed crypto import and signature verification because the bot must
// never depend on Facebook App Secret or verify request signatures.
// Instead, we simply accept all webhook requests. See README for details.

const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const { getConfig, getMissingConfigKeys } = require('./utils/safeConfig');
const logger = require('./utils/logger');
const fbApi = require('./utils/fbApi');
const pluginLoader = require('./utils/pluginLoader');
const userStore = require('./models/userStore');
const { setupHealthChecks } = require('./utils/healthMonitor');

// Initialise configuration. It will be reloaded on demand in certain
// handlers to pick up any changes made on disk while the server is running.
let config = getConfig();
// Track the most recent runtime error for dashboard display. This will be
// updated whenever an exception occurs during event handling or
// initialization. It should not cause the server to crash.
let lastRuntimeError = null;
const webhookPath = (config.server && config.server.webhookPath) || '/webhook';

// Create Express app
const app = express();

// Basic security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// CORS configuration: allow origins specified in config.security.allowedDomains
app.use(
  cors({
    origin: (config.security && config.security.allowedDomains) || '*',
    credentials: true,
  }),
);

// Response compression
app.use(compression());

// Body parsers: do not verify signatures or rely on app secrets. We simply
// parse incoming JSON and URL encoded bodies. Removing the verify
// callback ensures the bot does not depend on Facebook App Secret.
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static assets for the dashboard. This route works even when the
// configuration file is missing. If files do not exist they will return 404.
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard')));

// Status endpoint providing a JSON overview of the bot's state. Used by the
// dashboard and external health checks. Always succeeds without throwing.
app.get('/status', (req, res) => {
  // Reload configuration to reflect changes on disk
  config = getConfig();
  const missing = getMissingConfigKeys();
  const callbackUrl = `${req.protocol}://${req.get('host')}${webhookPath}`;
  const status = missing.length === 0 ? 'READY' : 'SETUP REQUIRED';
  const pageInfo = {
    id: (config.facebook && config.facebook.pageId) || '',
    name: (config.app && config.app.name) || 'FB Page Bot',
  };
  res.json({
    status,
    missingConfig: missing,
    callbackUrl,
    verifyToken: (config.facebook && config.facebook.verifyToken) || '',
    page: pageInfo,
    lastError: lastRuntimeError,
  });
});

// Root route: redirect to dashboard for browsers or status for API calls
app.get('/', (req, res) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/status');
  }
});

// Meta webhook verification (GET). Responds with hub.challenge on success or
// 403 on failure. Never throws an exception.
app.get(webhookPath, (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = (config.facebook && config.facebook.verifyToken) || '';
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('✅ Webhook verified successfully');
      res.status(200).send(challenge || '');
    } else {
      logger.warn('❌ Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  } catch (err) {
    logger.error('Error in webhook verification:', err.message);
    lastRuntimeError = err.message;
    // Return a generic response to prevent repeated retries by Facebook
    res.status(200).send('');
  }
});

// Webhook event receiver (POST). Always acknowledges receipt immediately.
app.post(webhookPath, (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  // Reload configuration to reflect any runtime changes
  config = getConfig();
  // Skip processing if the access token is missing
  if (!config.facebook || !config.facebook.pageAccessToken) {
    logger.warn('⚠️ Skipping webhook event processing: pageAccessToken is missing');
    return;
  }
  const body = req.body || {};
  try {
    if (body.object !== 'page') return;
    // Lazy require of handlers to isolate import errors
    let handlers;
    try {
      handlers = require('./handlres/index');
    } catch (handlerErr) {
      logger.error('❌ Failed to load message handlers:', handlerErr.message);
      return;
    }
    const { handleMessage, handlePostback, handleComment } = handlers;
    // Process each entry asynchronously; errors will be logged
    body.entry?.forEach((entry) => {
      // Messaging events (messages and postbacks)
      entry.messaging?.forEach((event) => {
        const senderId = event.sender && event.sender.id;
        const recipientId = event.recipient && event.recipient.id;
        const timestamp = event.timestamp || Date.now();
        try {
          if (event.message) {
            Promise.resolve(
              handleMessage(event.message, senderId, recipientId, timestamp),
            ).catch((err) => {
              logger.error('Error handling message:', err.message);
            });
          } else if (event.postback) {
            Promise.resolve(
              handlePostback(event.postback, senderId, recipientId, timestamp),
            ).catch((err) => {
              logger.error('Error handling postback:', err.message);
            });
          }
        } catch (err) {
          logger.error('Error dispatching messaging event:', err.message);
        }
      });
      // Feed changes (comments)
      entry.changes?.forEach((change) => {
        const value = change.value || {};
        if (change.field === 'feed' && value.item === 'comment' && value.verb === 'add') {
          const commentId = value.comment_id;
          const postId = value.post_id;
          const senderId = value.from && value.from.id;
          const senderName = value.from && value.from.name;
          const message = value.message || '';
          const createdAt = value.created_time || Date.now();
          try {
            Promise.resolve(
              handleComment(
                { commentId, postId, senderId, senderName, message, createdAt },
                entry.id,
              ),
            ).catch((err) => {
              logger.error('Error handling comment:', err.message);
            });
          } catch (err) {
            logger.error('Error dispatching comment event:', err.message);
          }
        }
      });
    });
  } catch (err) {
    logger.error('Error processing webhook event:', err.message);
    lastRuntimeError = err.message;
  }
});

// Asynchronous initialisation. Load the user store, plugins and health checks.
(async function init() {
  try {
    logger.botStart();
    await userStore
      .init()
      .catch((err) => {
        logger.warn('⚠️ User store initialisation failed:', err.message);
      });
    await pluginLoader
      .initialize()
      .catch((err) => {
        logger.warn('⚠️ Plugin system initialisation failed:', err.message);
      });
    // Set up health checks if enabled. Errors are logged and do not crash the server.
    if (config.server && config.server.enableHealthCheck) {
      try {
        await setupHealthChecks();
      } catch (healthErr) {
        logger.warn('⚠️ Health checks setup failed:', healthErr.message);
      }
    }
    logger.botReady();
  } catch (err) {
    logger.error('Initialisation error:', err.message);
  }
})();

// Export the app for serverless platforms. This file must not call app.listen().
module.exports = app;