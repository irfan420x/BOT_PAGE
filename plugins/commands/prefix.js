/**
 * Prefix Command Plugin
 * Show or set a user's command prefix. If called without arguments, the
 * current custom prefix and the global default are returned. If a new
 * prefix is provided, it is saved for the user. Users can reset their
 * prefix by passing the word "reset" or leaving it empty.
 *
 * This command makes it easy for users to discover which prefix to use
 * when invoking other commands, especially if they've changed it from
 * the global default. It also provides a simple way to customise the
 * prefix on a per‑user basis.
 */

const fbApi = require('../../utils/fbApi');
const config = require('../../config.json');
const userStore = require('../../models/userStore');

module.exports = {
  config: {
    name: 'prefix',
    aliases: ['setprefix', 'myprefix'],
    description: 'Show or set your command prefix',
    category: 'general',
    usage: '/prefix [newPrefix]',
    credits: 'IRFAN + Assistant',
    dependencies: [],
  },

  /**
   * Execute the prefix command. When a new prefix is provided it must
   * be a single non‑empty string without spaces. If the argument is
   * "reset", the user's prefix is cleared and reverts to the global
   * prefix configured in config.bot.prefix.
   *
   * @param {string} senderId The user's PSID
   * @param {Array<string>} args Array of arguments supplied after the command
   */
  start: async function(senderId, args) {
    try {
      // When called with no arguments, simply show the current prefix
      if (!args || args.length === 0) {
        const userPrefix = await userStore.getPrefix(senderId);
        const globalPrefix = config.bot.prefix;
        const message = `📌 Your current prefix: \`${userPrefix}\`\n` +
                        `🌐 Global prefix: \`${globalPrefix}\`\n\n` +
                        `To change your prefix, use: \`${userPrefix}prefix <newPrefix>\`\n` +
                        `To reset your prefix, use: \`${userPrefix}prefix reset\``;
        await fbApi.sendMessage(senderId, message);
        return;
      }
      const newPrefix = args[0].trim();
      // If user wants to reset their prefix
      if (newPrefix.toLowerCase() === 'reset') {
        await userStore.setPrefix(senderId, config.bot.prefix);
        await fbApi.sendMessage(senderId, `🔄 Prefix reset to global default: \`${config.bot.prefix}\``);
        return;
      }
      // Validate the new prefix. We disallow spaces to prevent confusion
      if (newPrefix.length === 0 || /\s/.test(newPrefix)) {
        await fbApi.sendMessage(senderId, '❌ Invalid prefix. Please provide a single word or symbol with no spaces.');
        return;
      }
      // Save the new prefix
      await userStore.setPrefix(senderId, newPrefix);
      await fbApi.sendMessage(senderId, `✅ Your prefix has been updated to \`${newPrefix}\`. Use it before commands, e.g. \`${newPrefix}help\`.`);
    } catch (error) {
      console.error('Error in prefix command:', error);
      await fbApi.sendMessage(senderId, '⚠️ An error occurred while updating your prefix. Please try again later.');
    }
  },
};