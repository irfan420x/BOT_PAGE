/**
 * Ping Command Plugin
 * A simple health check command. Responds with bot uptime and a "pong".
 * Author: OpenAI Assistant
 * Version: 1.0.0
 */

const fbApi = require('../../utils/fbApi');
const os = require('os');
const processStartTime = Date.now();

module.exports = {
  config: {
    name: 'ping',
    aliases: ['pong', 'status'],
    description: 'Check if the bot is running and view basic status',
    category: 'utility',
    usage: '/ping',
    credits: 'OpenAI Assistant',
    dependencies: [],
  },
  /**
   * Respond to a ping command with bot status information.
   * @param {string} senderId - The PSID of the user.
   * @param {string[]} args - Additional arguments (unused).
   * @param {string} originalMessage - The original message content (unused).
   */
  start: async function(senderId, args, originalMessage) {
    try {
      const uptimeMs = Date.now() - processStartTime;
      const uptimeSeconds = Math.floor(uptimeMs / 1000);
      const uptimeMinutes = Math.floor(uptimeSeconds / 60);
      const memoryUsage = process.memoryUsage();
      const usedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
      const totalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
      const response = [
        '🏓 Pong! I’m alive.',
        `⏱️ Uptime: ${uptimeMinutes} minute(s)`,
        `💾 Memory Usage: ${usedMB} MB used / ${totalMB} MB total`,
      ].join('\n');
      await fbApi.sendMessage(senderId, response);
    } catch (error) {
      console.error('Error in ping command:', error);
      await fbApi.sendMessage(senderId,
        'Sorry, I could not process your request.'
      );
    }
  },
};