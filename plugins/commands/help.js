/**
 * Help Command Plugin
 * Shows all available commands
 * Author: IRFAN
 * Version: 2.0.0
 */

const config = require('../../config.json');
const fbApi = require('../../utils/fbApi');
// Import the user store so we can fetch a user's custom prefix. When a
// prefix isn't set for a user, the global prefix from config.bot.prefix
// will be used. This allows the help command to display the correct
// prefix per user.
const userStore = require('../../models/userStore');

module.exports = {
  config: {
    name: 'help',
    aliases: ['h', 'commands', 'menu'],
    description: 'Show all available commands',
    category: 'general',
    usage: '/help [command]',
    credits: 'IRFAN',
    dependencies: [],
  },

  start: async function(senderId, args, originalMessage) {
    try {
      const commandPlugins = require('../../utils/pluginLoader').getCommandPlugins();
      
      // If specific command requested
      if (args.length > 0) {
        const commandName = args[0].toLowerCase();
        const plugin = commandPlugins.find(
          p => p.config.name === commandName || 
               (p.config.aliases && p.config.aliases.includes(commandName))
        );
        
        if (plugin) {
          const details = `
🔍 *Command Details*:
• *Name*: ${plugin.config.name}
• *Description*: ${plugin.config.description}
• *Category*: ${plugin.config.category}
• *Usage*: \`${plugin.config.usage}\`
• *Aliases*: ${plugin.config.aliases?.join(', ') || 'None'}
• *Credits*: ${plugin.config.credits}
          `.trim();
          
          await fbApi.sendMessage(senderId, details);
          return;
        } else {
          await fbApi.sendMessage(senderId, 
            `Command "${args[0]}" not found. Use /help to see all commands.`
          );
          return;
        }
      }
      
      // Group commands by category
      const commandsByCategory = {};
      for (const plugin of commandPlugins) {
        const category = plugin.config.category || 'general';
        if (!commandsByCategory[category]) {
          commandsByCategory[category] = [];
        }
        commandsByCategory[category].push(plugin.config);
      }
      
      // Build help message
      // Determine the prefix for this user. Use the custom prefix if set,
      // otherwise fall back to the global default. This ensures the help
      // message reflects the prefix the user should use to invoke commands.
      const userPrefix = await userStore.getPrefix(senderId);
      const prefix = userPrefix || config.bot.prefix;

      let helpMessage = `🤖 *${config.bot.name} Help Menu*\n\n`;
      helpMessage += `*Prefix*: \`${prefix}\`\n`;
      helpMessage += `*Total Commands*: ${commandPlugins.length}\n\n`;
      
      for (const [category, commands] of Object.entries(commandsByCategory)) {
        helpMessage += `📁 *${category.toUpperCase()}*\n`;
        commands.forEach(cmd => {
          helpMessage += `• \`${prefix}${cmd.name}\` - ${cmd.description}\n`;
        });
        helpMessage += '\n';
      }
      
      helpMessage += `📝 *Usage*: Use \`${prefix}help [command]\` for details\n`;
      helpMessage += `⚡ *Bot Version*: ${config.app.version}\n`;
      helpMessage += `👨‍💻 *Author*: ${config.app.author}`;
      
      // Add quick replies for categories
      const quickReplies = Object.keys(commandsByCategory).map(category => ({
        content_type: 'text',
        title: category.charAt(0).toUpperCase() + category.slice(1),
        payload: `HELP_CATEGORY_${category.toUpperCase()}`,
      }));
      
      // Add all commands quick reply
      quickReplies.push({
        content_type: 'text',
        title: '📋 All Commands',
        payload: 'HELP_ALL_COMMANDS',
      });
      
      await fbApi.sendMessage(senderId, helpMessage, 'quick_replies', {
        quickReplies,
      });
      
    } catch (error) {
      console.error('Error in help command:', error);
      await fbApi.sendMessage(senderId, 
        'Sorry, I encountered an error showing the help menu.'
      );
    }
  },
};