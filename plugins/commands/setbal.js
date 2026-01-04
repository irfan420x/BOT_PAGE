/**
 * Set Balance Command Plugin
 * Allows administrators to set the game balance for a specific user.
 *
 * Usage: /setbal <uid> <amount>
 * Example: /setbal 1234567890 500
 *
 * Only users whose UID is listed in config.security.adminUIDs may execute
 * this command. The command validates the amount to ensure it is a
 * number. After updating the user's balance, the bot sends a
 * confirmation message to the admin and optionally notifies the
 * recipient user of their new balance.
 */

const fbApi = require('../../utils/fbApi');
const config = require('../../config.json');
const userStore = require('../../models/userStore');

module.exports = {
  config: {
    name: 'setbal',
    aliases: ['setbalance'],
    description: 'Set the game balance for a user (admin only)',
    category: 'admin',
    usage: '/setbal <uid> <amount>',
    credits: 'IRFAN + Assistant',
    dependencies: [],
  },

  start: async function(senderId, args) {
    try {
      // Validate arguments
      if (!args || args.length < 2) {
        await fbApi.sendMessage(senderId, '⚠️ Usage: /setbal <uid> <amount>');
        return;
      }
      const targetUid = args[0];
      const amount = Number(args[1]);
      if (isNaN(amount)) {
        await fbApi.sendMessage(senderId, '❌ Invalid amount. Please provide a numeric value.');
        return;
      }
      // Update balance
      const updatedUser = await userStore.setBalance(targetUid, amount);
      // Confirmation message to admin
      await fbApi.sendMessage(senderId, `✅ Balance for user ${targetUid} set to ${amount}.`);
      // Optionally notify the target user if they are not the admin
      if (targetUid !== senderId) {
        try {
          await fbApi.sendMessage(targetUid, `💰 Your game balance has been updated to ${amount}.`);
        } catch (notifyErr) {
          // Fail silently if the user cannot be notified (e.g. hasn't started chat)
          console.warn('Could not notify user of balance update:', notifyErr.message);
        }
      }
    } catch (error) {
      console.error('Error in setbal command:', error);
      await fbApi.sendMessage(senderId, '⚠️ Failed to set balance. Please try again.');
    }
  },
};