require("dotenv").config();
const { Telegraf } = require("telegraf");

// Bot token
const BOT_TOKEN =
  process.env.BOT_TOKEN || "8154452204:AAFL4wE2S4mmuuhOJRQXQKIQKw0FfeFkJY4";

// Message to send
const MESSAGE = `🎮 *Test Broadcast Message* 🎲

This is a test broadcast message from the Bingo Game bot! 

Stay tuned for upcoming games and exciting offers. We're continuously improving our platform for the best gaming experience.

Thank you for being part of our community!`;

async function sendTestMessage() {
  try {
    console.log("Initializing bot with token:", BOT_TOKEN);
    const bot = new Telegraf(BOT_TOKEN);

    // Send test message to the specified chat ID
    // Replace this with your own Telegram ID for testing
    const CHAT_ID = process.argv[2] || "7643974412";

    console.log(`Sending test message to chat ID: ${CHAT_ID}`);

    // Send message with button
    await bot.telegram.sendMessage(CHAT_ID, MESSAGE, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎮 Start Playing",
              web_app: {
                url: process.env.WEBAPP_URL || "https://your-webapp-url.com",
              },
            },
          ],
        ],
      },
    });

    console.log("Message sent successfully!");
  } catch (error) {
    console.error("Error sending message:", error);
  }

  process.exit(0);
}

// Run the function
sendTestMessage();
