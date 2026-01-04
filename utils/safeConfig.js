/**
 * safeConfig.js
 *
 * A robust configuration loader that gracefully handles missing or corrupt
 * configuration files. This module guarantees that a valid configuration
 * object is always returned, even if `config.json` is absent, invalid or
 * missing required fields. It also exposes a helper to discover which
 * critical configuration values are still undefined so the dashboard can
 * surface them to the user.
 *
 * The default on‑disk configuration file (`config.json` at the project root)
 * follows the minimal template specified in the user requirements. At
 * runtime this module merges the minimal config with a richer set of
 * sensible defaults (such as `bot.prefix`, logging options and plugin
 * defaults) so that the rest of the application can rely on these values
 * without fear of crashing. Missing keys will resolve to the defaults
 * defined below. See `fallbackConfig` for the full list of mergeable
 * defaults.
 */

const fs = require('fs');
const path = require('path');

// The minimal configuration template that will be written to disk when
// `config.json` does not exist. Do not remove or alter keys here unless
// updating the required schema; this template forms the basis of the
// user‑editable configuration file.
const minimalTemplate = {
  app: {
    name: 'FB Page Bot',
    version: '3.0.0',
    author: 'IRFAN',
  },
  facebook: {
    pageAccessToken: '',
    verifyToken: 'xx',
    pageId: '',
    appSecret: '',
  },
  server: {
    webhookPath: '/webhook',
  },
};

// A comprehensive set of fallback values used internally by the
// application. These values are merged on top of the user configuration
// loaded from disk. They provide default behaviour for sections of the
// configuration that are optional (e.g. logging, plugin defaults) and
// prevent the rest of the codebase from having to guard against
// undefined properties on the config object. Do not persist these
// fallback values back to disk – they are intended purely for runtime use.
const fallbackConfig = {
  app: {
    name: 'FB Page Bot',
    version: '3.0.0',
    author: 'IRFAN',
  },
  facebook: {
    pageAccessToken: '',
    verifyToken: 'xx',
    pageId: '',
    appSecret: '',
  },
  bot: {
    name: 'Page Bot',
    prefix: '/',
    timezone: 'UTC',
    autoRestart: false,
    maxRetries: 3,
    cooldown: 500,
  },
  logging: {
    level: 'info',
    retentionDays: 7,
    logToFile: false,
    logToConsole: true,
  },
  security: {
    adminUIDs: [],
    allowedDomains: ['*'],
    rateLimit: {
      windowMs: 900000, // 15 minutes
      max: 100,
    },
  },
  features: {
    enableBroadcast: false,
    enableAnalytics: false,
    enableAutoReplies: true,
    enableScheduledPosts: false,
    enableMultiLanguage: false,
    enableWebDashboard: true,
  },
  pluginDefaults: {
    autoInstallDeps: false,
    hotReload: false,
    maxExecutionTime: 5000,
    memoryLimitMB: 50,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    webhookPath: '/webhook',
    enableHealthCheck: true,
    enableMetrics: true,
  },
};

// Determine the absolute path to the project's configuration file. We
// resolve relative to the location of this file, navigating up two
// directories to reach the root of the project. This avoids relying on
// process.cwd() which may vary between serverless and local environments.
const configPath = path.join(__dirname, '..', 'config.json');

/**
 * Deep merge helper. Mutates the target object by copying properties
 * from the source object. Nested objects are merged recursively. Arrays
 * and primitive values in the source overwrite those in the target.
 *
 * @param {Object} target
 * @param {Object} source
 * @returns {Object} The mutated target object
 */
function mergeDeep(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Ensure the presence of `config.json`. If it does not exist, a copy of
 * the minimal template will be written to disk. This function is idempotent
 * and does nothing if the file already exists.
 */
function ensureConfigFile() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(minimalTemplate, null, 2));
      console.log(`Created default configuration at ${configPath}`);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to create default config file: ${err.message}`);
  }
}

/**
 * Load the raw configuration object from disk. If the file is invalid JSON
 * or cannot be read, a backup of the corrupt file is created and the
 * minimal template is used instead. This function does not merge with
 * fallback values – it merely returns whatever is on disk or the minimal
 * template.
 *
 * @returns {Object} The configuration object read from disk
 */
function loadConfigRaw() {
  ensureConfigFile();
  let configData = minimalTemplate;
  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    try {
      configData = JSON.parse(fileContents);
    } catch (parseErr) {
      // Backup the invalid configuration for later inspection
      const backupPath = `${configPath}.bak`;
      fs.writeFileSync(backupPath, fileContents);
      console.warn(
        `⚠️ Invalid JSON in config.json. A backup was saved to ${backupPath} and the default template will be used.`,
      );
      configData = minimalTemplate;
      fs.writeFileSync(configPath, JSON.stringify(minimalTemplate, null, 2));
    }
  } catch (err) {
    console.warn(`⚠️ Failed to read config.json: ${err.message}`);
  }
  return configData;
}

/**
 * Merge the raw user configuration with the fallback defaults and return
 * the result. The user configuration takes precedence over fallback values.
 *
 * @returns {Object} The merged configuration object
 */
function getConfig() {
  const raw = loadConfigRaw();
  // Start with a deep clone of the fallbackConfig so we don't mutate it
  const merged = JSON.parse(JSON.stringify(fallbackConfig));
  mergeDeep(merged, raw);
  return merged;
}

/**
 * Determine which configuration values are missing or empty in the raw
 * configuration. Only checks keys defined in the minimal template. This
 * information is useful for the dashboard to indicate which settings need
 * to be filled in before the bot can operate fully. Keys whose values
 * evaluate to an empty string, null or undefined are considered missing.
 *
 * @returns {Array<string>} A list of dot‑separated key paths that are missing
 */
function getMissingConfigKeys() {
  const raw = loadConfigRaw();
  const missing = [];
  // Helper to traverse the minimal template and collect missing keys
  function check(template, obj, prefix = '') {
    for (const key of Object.keys(template)) {
      const pathKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof template[key] === 'object' &&
        template[key] !== null &&
        !Array.isArray(template[key])
      ) {
        // Recurse into nested objects
        check(template[key], obj[key] || {}, pathKey);
      } else {
        const val = obj && obj[key];
        if (val === '' || val === null || val === undefined) {
          missing.push(pathKey);
        }
      }
    }
  }
  check(minimalTemplate, raw);
  return missing;
}

/**
 * Persist a configuration object to disk. This method writes the provided
 * configuration to `config.json` with pretty printing. It should be used
 * sparingly since Vercel's serverless file system is read‑only outside
 * of `/tmp`. On traditional servers or during local development this can
 * be used to update the user configuration.
 *
 * @param {Object} config The configuration to save
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.warn(`⚠️ Failed to save config.json: ${err.message}`);
  }
}

module.exports = {
  getConfig,
  getMissingConfigKeys,
  saveConfig,
  minimalTemplate,
  fallbackConfig,
};