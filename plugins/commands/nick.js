/**
 * Nickname Command Plugin
 * Allows a user to set or get their nickname. Nicknames are stored in
 * the user store and can be used by other parts of the bot (e.g. games
 * or greeting messages) to personalise interactions. When called with
 * no arguments, the current nickname is returned. When arguments are
 * provided, they are joined into a single string and set as the
 * nickname.
 *
 * Usage: /nick [newNickname]
 */

const fbApi = require('../../utils/fbApi');
const userStore = require('../../models/userStore');

module.exports = {
  config: {
    name: 'nick',
    aliases: ['nickname', 'setnick'],
    description: 'Set or get your nickname',
    category: 'general',
    usage: '/nick [nickname]',
    credits: 'IRFAN + Assistant',
    dependencies: [],
  },

  start: async function(senderId, args) {
    try {
      // If no arguments, return the current nickname
      if (!args || args.length === 0) {
        const nickname = await userStore.getNickname(senderId);
        if (nickname) {
          await fbApi.sendMessage(senderId, `👤 Your nickname is set to "${nickname}".`);
        } else {
          await fbApi.sendMessage(senderId, '👤 You have not set a nickname yet. Use `/nick YourName` to set one.');
        }
        return;
      }
      // Join all arguments to form the nickname
      const newNickname = args.join(' ').trim();
      if (newNickname.length === 0) {
        await fbApi.sendMessage(senderId, '❌ Please provide a valid nickname.');
        return;
      }
      // Save nickname
      await userStore.setNickname(senderId, newNickname);
      await fbApi.sendMessage(senderId, `✅ Your nickname has been updated to "${newNickname}".`);
    } catch (error) {
      console.error('Error in nick command:', error);
      await fbApi.sendMessage(senderId, '⚠️ An error occurred while updating your nickname.');
    }
  },
};