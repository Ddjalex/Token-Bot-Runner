const express = require("express");
const router = express.Router();
const db = require("../config/db");
const telegramAuthService = require("../services/telegramAuthService");

// Utility function to safely send messages
const safeSendMessage = async (bot, chatId, message, options = {}) => {
  try {
    return await bot.telegram.sendMessage(chatId, message, options);
  } catch (error) {
    if (
      error.description &&
      error.description.includes("bot was blocked by the user")
    ) {
      console.log(`User ${chatId} has blocked the bot, can't send message`);
      return null;
    }
    // Log other errors but don't throw them
    console.error(`Error sending message to ${chatId}:`, error);
    return null;
  }
};

// Utility function to safely send photos
const safeSendPhoto = async (bot, chatId, photo, options = {}) => {
  try {
    return await bot.telegram.sendPhoto(chatId, photo, options);
  } catch (error) {
    if (
      error.description &&
      error.description.includes("bot was blocked by the user")
    ) {
      console.log(`User ${chatId} has blocked the bot, can't send photo`);
      return null;
    }
    // Log other errors but don't throw them
    console.error(`Error sending photo to ${chatId}:`, error);
    return null;
  }
};

// Middleware to check API key for admin routes
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

// Get all Telegram users
router.get("/users", checkApiKey, async (req, res) => {
  try {
    const [users] = await db.execute(
      "SELECT id, username, telegram_id, created_at FROM users WHERE telegram_id IS NOT NULL"
    );
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching Telegram users:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching Telegram users" });
  }
});

// Link user account with Telegram
router.post("/link-account", async (req, res) => {
  try {
    const { userId, telegramId, telegramUsername } = req.body;

    if (!userId || !telegramId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Telegram ID are required",
      });
    }

    // Check if user exists
    const [userRows] = await db.execute("SELECT id FROM users WHERE id = ?", [
      userId,
    ]);
    if (userRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Update user with Telegram info
    await db.execute(
      "UPDATE users SET telegram_id = ?, telegram_username = ? WHERE id = ?",
      [telegramId, telegramUsername, userId]
    );

    res
      .status(200)
      .json({ success: true, message: "Account linked successfully" });
  } catch (error) {
    console.error("Error linking account:", error);
    res.status(500).json({ success: false, message: "Error linking account" });
  }
});

// Bot broadcast message to all users
router.post("/bot-broadcast", checkApiKey, async (req, res) => {
  try {
    const { message, includeStartButton } = req.body;

    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "Message is required" });
    }

    // Get the bot instance from the app
    const bot = req.app.get("botInstance");

    if (!bot) {
      return res.status(500).json({
        success: false,
        message: "Bot instance not available",
      });
    }

    // Get all users from database
    const [users] = await db.execute(
      "SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL"
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found with Telegram IDs",
      });
    }

    // Send message to all users
    let successful = 0;
    let failed = 0;

    for (const user of users) {
      // Prepare message options
      const options = {};

      // Add inline keyboard if requested
      if (includeStartButton) {
        options.reply_markup = {
          inline_keyboard: [
            [
              {
                text: "🎮 Start App",
                web_app: { url: process.env.WEBAPP_URL },
              },
            ],
          ],
        };
      }

      // Send message through the bot using safeSendMessage
      const result = await safeSendMessage(
        bot,
        user.telegram_id,
        message,
        options
      );
      if (result) {
        successful++;
      } else {
        failed++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Broadcast complete. Successfully sent: ${successful}, Failed: ${failed}`,
    });
  } catch (error) {
    console.error("Error broadcasting message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to broadcast message",
    });
  }
});

// Admin broadcast message with image support
router.post("/admin-broadcast", async (req, res) => {
  try {
    const { message, includeImage, imageType, imageData, imageName } = req.body;

    if (!message) {
      return res

        .status(400)
        .json({ success: false, message: "Message is required" });
    }

    // Get the bot instance from the app
    const bot = req.app.get("botInstance");

    if (!bot) {
      return res.status(500).json({
        success: false,
        message: "Bot instance not available",
      });
    }

    // Get all users from database
    const [users] = await db.execute(
      "SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL"
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found with Telegram IDs",
      });
    }

    // Send message to all users
    let successful = 0;
    let failed = 0;

    // Prepare image buffer if we have image data
    let imageBuffer = null;
    if (includeImage && imageType === "custom" && imageData) {
      imageBuffer = Buffer.from(imageData, "base64");
    }

    for (const user of users) {
      let result = null;
      if (includeImage) {
        if (imageType === "custom" && imageBuffer) {
          // Send the processed image directly from buffer using safeSendPhoto
          result = await safeSendPhoto(
            bot,
            user.telegram_id,
            { source: imageBuffer },
            {
              caption: message,
              parse_mode: "HTML",
            }
          );
        } else {
          // Use default welcome image with safeSendPhoto
          result = await await safeSendMessage(bot, user.telegram_id, message, {
          parse_mode: "HTML",
        });
        }
      } else {
        // Send text message using safeSendMessage
        result = await safeSendMessage(bot, user.telegram_id, message, {
          parse_mode: "HTML",
        });
      }

      if (result) {
        successful++;
      } else {
        failed++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Admin broadcast complete. Successfully sent: ${successful}, Failed: ${failed}`,
      stats: { successful, failed, total: users.length },
    });
  } catch (error) {
    console.error("Error broadcasting admin message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to broadcast admin message",
      error: error.message,
    });
  }
});

// Get user details by Telegram ID
router.get("/user/:telegramId", async (req, res) => {
  try {
    const { telegramId } = req.params;

    if (!telegramId) {
      return res
        .status(400)
        .json({ success: false, message: "Telegram ID is required" });
    }

    const [userRows] = await db.execute(
      "SELECT id, username, email, balance, created_at FROM users WHERE telegram_id = ?",
      [telegramId]
    );

    if (userRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: userRows[0] });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching user details" });
  }
});

// Get user's game history
router.get("/user/:telegramId/games", async (req, res) => {
  try {
    const { telegramId } = req.params;

    if (!telegramId) {
      return res
        .status(400)
        .json({ success: false, message: "Telegram ID is required" });
    }

    // Get user ID from telegram ID
    const [userRows] = await db.execute(
      "SELECT id FROM users WHERE telegram_id = ?",
      [telegramId]
    );

    if (userRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const userId = userRows[0].id;

    // Get user's game history
    const [gameRows] = await db.execute(
      `SELECT g.id, g.name, g.game_type_id, g.start_time, g.end_time, g.status, 
       p.is_winner, p.prize_amount 
       FROM games g 
       JOIN participants p ON g.id = p.game_id 
       WHERE p.user_id = ? 
       ORDER BY g.start_time DESC LIMIT 10`,
      [userId]
    );

    res.status(200).json({ success: true, data: gameRows });
  } catch (error) {
    console.error("Error fetching game history:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching game history" });
  }
});

// Add a new route for verifying users by Telegram ID only (for Mini App)
router.post("/verify-telegram-id", async (req, res) => {
  try {
    const { telegram_id } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        success: false,
        message: "Telegram ID is required",
      });
    }

    const user = await telegramAuthService.verifyUserByTelegramId(telegram_id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this Telegram ID",
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        phone_number: user.phone_number,
        balance: user.balance,
        telegram_id: user.telegram_id,
      },
    });
  } catch (error) {
    console.error("Error verifying Telegram ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error during verification",
    });
  }
});

module.exports = router;
