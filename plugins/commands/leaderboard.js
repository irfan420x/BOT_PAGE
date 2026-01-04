/**
 * Leaderboard Command Plugin
 * Displays the top users by their game balance. This command can be used
 * to create friendly competition among users and to motivate engagement
 * with the bot's games. The default behaviour is to show the top 10,
 * but the number of entries can be customised by providing an optional
 * argument.
 *
 * Usage: /leaderboard [limit]
 */

const fbApi = require('../../utils/fbApi');
const userStore = require('../../models/userStore');

module.exports = {
  config: {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    description: 'Show the top users by balance',
    category: 'general',
    usage: '/leaderboard [limit]',
    credits: 'IRFAN + Assistant',
    dependencies: [],
  },

  start: async function(senderId, args) {
    try {
      // Determine how many users to display. Default is 10.
      const limit = args && args.length > 0 ? parseInt(args[0], 10) : 10;
      const topUsers = await userStore.getTopUsers(limit);
      if (!topUsers || topUsers.length === 0) {
        await fbApi.sendMessage(senderId, 'No users have a balance yet. Play some games to get on the leaderboard!');
        return;
      }
      // Build leaderboard message
      let message = '🏆 *Leaderboard*\n\n';
      topUsers.forEach((user, index) => {
        const rank = index + 1;
        const nickname = user.nickname || '(no nick)';
        const uid = user.uid;
        message += `${rank}. ${nickname} (UID: ${uid}) – ${user.balance}\n`;
      });
      message += '\nKeep playing to climb the ranks!';
      await fbApi.sendMessage(senderId, message);
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      await fbApi.sendMessage(senderId, '⚠️ Unable to retrieve leaderboard. Please try again later.');
    }
  },
};