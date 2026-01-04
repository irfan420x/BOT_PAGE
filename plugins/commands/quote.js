/**
 * Random Quote Command Plugin
 * Returns an inspirational quote when the user invokes the /quote command.
 * Author: OpenAI Assistant
 * Version: 1.0.0
 */

const fbApi = require('../../utils/fbApi');

// A collection of short, uplifting quotes suitable for teens.
const QUOTES = [
  'Believe you can and you’re halfway there.',
  'The only way to do great work is to love what you do.',
  'You are braver than you believe, stronger than you seem, and smarter than you think.',
  'Success is not final, failure is not fatal: it is the courage to continue that counts.',
  'Don’t watch the clock; do what it does. Keep going.',
  'Happiness is not something ready-made. It comes from your own actions.',
  'It always seems impossible until it’s done.',
  'The future belongs to those who believe in the beauty of their dreams.',
];

module.exports = {
  config: {
    name: 'quote',
    aliases: ['inspire', 'motivate'],
    description: 'Send a random inspirational quote',
    category: 'fun',
    usage: '/quote',
    credits: 'OpenAI Assistant',
    dependencies: [],
  },
  /**
   * Start the quote command. Selects a quote at random and sends it to the user.
   * @param {string} senderId - The PSID of the user.
   * @param {string[]} args - Additional arguments (unused).
   * @param {string} originalMessage - The original message content (unused).
   */
  start: async function(senderId, args, originalMessage) {
    try {
      const randomIndex = Math.floor(Math.random() * QUOTES.length);
      const quote = QUOTES[randomIndex];
      await fbApi.sendMessage(senderId, `💡 ${quote}`);
    } catch (error) {
      console.error('Error in quote command:', error);
      await fbApi.sendMessage(senderId,
        'Sorry, I couldn’t fetch a quote right now. Please try again later.'
      );
    }
  },
};