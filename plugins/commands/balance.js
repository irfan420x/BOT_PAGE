/**
 * Balance Command Plugin
 * Returns the current game balance for the user. This command provides
 * a friendly way for users to check how many credits or coins they have
 * accumulated through playing games or other interactions with the bot.
 *
 * Usage: /balance
 */

const fbApi = require('../../utils/fbApi');
const userStore = require('../../models/userStore');

module.exports = {
  config: {
    name: 'balance',
    aliases: ['bal', 'wallet'],
    description: 'Check your game balance',
    category: 'general',
    usage: '/balance',
    credits: 'IRFAN + Assistant',
    dependencies: [],
  },

  start: async function(senderId, args) {
    try {
      const balance = await userStore.getBalance(senderId);
      await fbApi.sendMessage(senderId, `💰 Your current balance is ${balance}.`);
    } catch (error) {
      console.error('Error in balance command:', error);
      await fbApi.sendMessage(senderId, '⚠️ Unable to retrieve your balance. Please try again later.');
    }
  },
};