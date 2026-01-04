/**
 * Help Category Postback Plugin
 * Handles category selection from help menu
 * Author: IRFAN
 * Version: 2.0.0
 */

const fbApi = require('../../utils/fbApi');

module.exports = {
  payload: 'HELP_CATEGORY_', // Prefix for category payloads
  
  start: async function(senderId, recipientId, payload) {
    try {
      const category = payload.replace('HELP_CATEGORY_', '').toLowerCase();
      const commandPlugins = require('../../utils/pluginLoader').getCommandPlugins();
      
      // Filter commands by category
      const categoryCommands = commandPlugins
        .filter(plugin => (plugin.config.category || 'general').toLowerCase() === category)
        .map(plugin => plugin.config);
      
      if (categoryCommands.length === 0) {
        await fbApi.sendMessage(senderId, 
          `No commands found in category: ${category}`
        );
        return;
      }
      
      let message = `📁 *${category.toUpperCase()} Commands*\n\n`;
      categoryCommands.forEach(cmd => {
        message += `• *${cmd.name}* - ${cmd.description}\n`;
        message += `  Usage: \`${cmd.usage}\`\n\n`;
      });
      
      message += `📝 Use \`/help [command]\` for detailed information`;
      
      await fbApi.sendMessage(senderId, message);
      
    } catch (error) {
      console.error('Error in help category postback:', error);
      await fbApi.sendMessage(senderId, 
        'Sorry, I encountered an error showing category commands.'
      );
    }
  },
};