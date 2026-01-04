/**
 * UserStore
 *
 * This module provides a simple user data store for the Facebook Page Bot. It
 * attempts to use MongoDB if a connection URI is provided (via the
 * `MONGODB_URI` environment variable or `config.db.uri`). If that fails or
 * no URI is configured, it falls back to using a local JSON file for
 * persistence. The store exposes asynchronous methods for retrieving and
 * updating user records, including game balance, custom prefixes and
 * nicknames.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
// Load configuration via safeConfig. We do not read config.json directly
// because it may be missing or invalid. The getConfig() function returns
// a merged configuration object with sensible defaults.
const { getConfig } = require('../utils/safeConfig');

class UserStore {
  constructor() {
    this.users = {};
    // Path to the local JSON file used as a fallback when MongoDB is not
    // available. The file will be created if it doesn't exist.
    // Determine a writable location for storing user data. When running
    // in serverless environments such as Vercel, the filesystem is
    // typically read‑only except for the /tmp directory. To avoid
    // crashing on write attempts, default to os.tmpdir() unless a
    // specific path is provided via the USER_STORE_FILE environment
    // variable. In local development the file path can be overridden.
    const defaultFile = path.join(__dirname, '../data/users.json');
    const tmpFile = path.join(os.tmpdir(), 'users.json');
    this.file = process.env.USER_STORE_FILE || tmpFile;
    this.mongoClient = null;
    this.collection = null;
    this.initialized = false;
  }

  /**
   * Initialise the user store. This function attempts to connect to MongoDB
   * first. If the connection is unsuccessful (e.g. missing dependency or
   * network failure) then it falls back to loading or creating a local JSON
   * file. It should be called during bot initialisation.
   */
  async init() {
    if (this.initialized) return;
    // Reload configuration here in case it changed at runtime
    const currentConfig = getConfig();
    const uri = process.env.MONGODB_URI || (currentConfig.db && currentConfig.db.uri);
    if (uri) {
      try {
        // Dynamically import the MongoDB driver. This may throw if the
        // dependency is not installed in the environment. We catch and
        // fallback to file storage in that case.
        const { MongoClient } = require('mongodb');
        this.mongoClient = new MongoClient(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        await this.mongoClient.connect();
        const dbName = process.env.DB_NAME || (currentConfig.db && currentConfig.db.name) || 'botdb';
        const db = this.mongoClient.db(dbName);
        this.collection = db.collection('users');
        this.initialized = true;
        return;
      } catch (err) {
        console.warn('[UserStore] MongoDB connection failed, using local JSON file:', err.message);
      }
    }
    // Fallback to JSON file
    await this.loadFromFile();
    this.initialized = true;
  }

  /**
   * Load user data from local JSON file. Creates the file if it doesn't
   * exist.
   */
  async loadFromFile() {
    try {
      const dir = path.dirname(this.file);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.file)) {
        const data = fs.readFileSync(this.file, 'utf-8');
        this.users = JSON.parse(data || '{}');
      } else {
        this.users = {};
        fs.writeFileSync(this.file, JSON.stringify(this.users, null, 2));
      }
    } catch (err) {
      console.error('[UserStore] Error loading user file:', err);
      this.users = {};
    }
  }

  /**
   * Persist the in-memory users object to the local JSON file. Called after
   * modifications when not using MongoDB.
   */
  async saveToFile() {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.users, null, 2));
    } catch (err) {
      console.error('[UserStore] Error saving user file:', err);
    }
  }

  /**
   * Retrieve a user record by their UID. If the user does not exist, a new
   * record is created with default values. When using MongoDB, the record
   * is created in the database on demand.
   *
   * @param {string} uid
   * @returns {Promise<Object>} The user object
   */
  async getUser(uid) {
    await this.init();
    if (this.collection) {
      let user = await this.collection.findOne({ uid });
      if (!user) {
        // When creating a new user, load the current config to determine
        // the global prefix. If config.bot or config.bot.prefix is
        // undefined, default to '/'.
        const currentConfig = getConfig();
        const defaultPrefix = (currentConfig.bot && currentConfig.bot.prefix) || '/';
        user = {
          uid,
          balance: 0,
          prefix: defaultPrefix,
          nickname: '',
        };
        await this.collection.insertOne(user);
      }
      return user;
    }
    if (!this.users[uid]) {
      const currentConfig = getConfig();
      const defaultPrefix = (currentConfig.bot && currentConfig.bot.prefix) || '/';
      this.users[uid] = {
        uid,
        balance: 0,
        prefix: defaultPrefix,
        nickname: '',
      };
      await this.saveToFile();
    }
    return this.users[uid];
  }

  /**
   * Update or set the user's game balance.
   * @param {string} uid
   * @param {number} amount
   * @returns {Promise<Object>} Updated user record
   */
  async setBalance(uid, amount) {
    const user = await this.getUser(uid);
    user.balance = Number(amount) || 0;
    if (this.collection) {
      await this.collection.updateOne({ uid }, { $set: { balance: user.balance } }, { upsert: true });
    } else {
      this.users[uid] = user;
      await this.saveToFile();
    }
    return user;
  }

  /**
   * Retrieve the user's balance.
   * @param {string} uid
   * @returns {Promise<number>}
   */
  async getBalance(uid) {
    const user = await this.getUser(uid);
    return user.balance;
  }

  /**
   * Set a custom prefix for a user. If no prefix is provided, the user's
   * prefix is reset to the global default.
   * @param {string} uid
   * @param {string} prefix
   * @returns {Promise<Object>} Updated user record
   */
  async setPrefix(uid, prefix) {
    const user = await this.getUser(uid);
    const currentConfig = getConfig();
    const defaultPrefix = (currentConfig.bot && currentConfig.bot.prefix) || '/';
    user.prefix = prefix || defaultPrefix;
    if (this.collection) {
      await this.collection.updateOne({ uid }, { $set: { prefix: user.prefix } }, { upsert: true });
    } else {
      this.users[uid] = user;
      await this.saveToFile();
    }
    return user;
  }

  /**
   * Retrieve a user's custom prefix if set, otherwise return the global prefix.
   * @param {string} uid
   * @returns {Promise<string>}
   */
  async getPrefix(uid) {
    const user = await this.getUser(uid);
    const currentConfig = getConfig();
    const defaultPrefix = (currentConfig.bot && currentConfig.bot.prefix) || '/';
    return user.prefix || defaultPrefix;
  }

  /**
   * Set or update a user's nickname.
   * @param {string} uid
   * @param {string} nickname
   * @returns {Promise<Object>} Updated user record
   */
  async setNickname(uid, nickname) {
    const user = await this.getUser(uid);
    user.nickname = nickname;
    if (this.collection) {
      await this.collection.updateOne({ uid }, { $set: { nickname: nickname } }, { upsert: true });
    } else {
      this.users[uid] = user;
      await this.saveToFile();
    }
    return user;
  }

  /**
   * Retrieve a user's nickname.
   * @param {string} uid
   * @returns {Promise<string>}
   */
  async getNickname(uid) {
    const user = await this.getUser(uid);
    return user.nickname;
  }

  /**
   * Retrieve a list of the top users ranked by balance. Returns an array
   * of user objects sorted in descending order by their `balance`. If
   * MongoDB is available, the sorting and limiting is performed in the
   * database. Otherwise, it operates on the in‑memory users object.
   *
   * @param {number} limit The maximum number of users to return
   * @returns {Promise<Array<Object>>}
   */
  async getTopUsers(limit = 10) {
    await this.init();
    // Default to 10 if an invalid limit is provided
    const max = Number(limit) > 0 ? Number(limit) : 10;
    if (this.collection) {
      // Fetch top users from MongoDB, sorted by balance descending
      const cursor = this.collection
        .find({})
        .sort({ balance: -1 })
        .limit(max);
      const users = await cursor.toArray();
      return users;
    }
    // Local file fallback
    const allUsers = Object.values(this.users);
    // Sort by balance descending, then by uid to break ties
    const sorted = allUsers.sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return a.uid.localeCompare(b.uid);
    });
    return sorted.slice(0, max);
  }
}

module.exports = new UserStore();
