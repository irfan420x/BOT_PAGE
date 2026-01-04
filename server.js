/**
 * server.js (traditional server entry)
 *
 * This file starts the Express application for environments that support
 * long‑lived servers such as Render or local development. It imports the
 * serverless app from `index.js` and calls `listen()` on the configured
 * port and host. Errors are caught and logged instead of crashing the
 * process.
 */

const app = require('./index');
const { getConfig } = require('./utils/safeConfig');
const config = getConfig();

// Determine the host and port from configuration or environment
const port = process.env.PORT || (config.server && config.server.port) || 3000;
const host = (config.server && config.server.host) || '0.0.0.0';

try {
  app.listen(port, host, () => {
    console.log(`🚀 Server listening on http://${host}:${port}`);
  });
} catch (err) {
  console.error('Failed to start server:', err);
}