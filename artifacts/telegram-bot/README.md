# Bingo Game Telegram Mini App

This directory contains the Telegram mini-app implementation for the Bingo Game application. The mini-app allows users to play the Bingo game directly within Telegram, providing a convenient and seamless gaming experience.

## Features

- Telegram mini-app for playing Bingo
- Inline button that says "Start Playing"
- Admin panel integration for sending messages to Telegram users
- User account linking between web app and Telegram
- API endpoints for Telegram bot functionality
- Referral system for user acquisition and rewards

## Setup Instructions

1. **Configure Environment Variables**:
   Copy the `.env.example` file to `.env` and fill in the required variables:

   ```
   BOT_TOKEN=your_telegram_bot_token
   WEBAPP_URL=https://your-webapp-url.com
   API_BASE_URL=https://api.chapabingo.com/api
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=password
   DB_NAME=bingo_db
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=7d
   PORT=3001
   ```

2. **Install Dependencies**:

   ```
   npm install
   ```

3. **Run Database Migrations**:

   ```
   node migrations/add-telegram-fields.js
   ```

4. **Start the Bot**:

   ```
   npm start
   ```

5. **Start the Mini App Server** (in a separate terminal):
   ```
   node server.js
   ```

## Bot Commands

- `/start` - Start the bot and get the main menu
- `/help` - Show help message and information

## Referral System

The Telegram bot includes a full-featured referral system that allows users to:

1. Generate and share unique referral links with friends
2. Track referral statistics (number of referred users and earnings)
3. Earn commission when referred users make their first deposit
4. Copy referral links for easy sharing

### How it Works

1. Each user is assigned a unique referral code when they register
2. Users can share their referral link via Telegram or other platforms
3. When a new user joins using a referral link and makes their first deposit, the referrer receives a bonus
4. The bonus amount is a percentage of the first deposit, configured in the referral settings
5. The referrer is automatically notified when they earn a referral bonus

### Referral System Setup

To set up the referral system, run the migration script:

```
node run-referral-migration.js
```

This will:

- Add referral fields to the users table
- Create the referral_earnings table
- Create the referral_settings table
- Generate referral codes for existing users

### Customizing Referral Settings

The default referral settings are:

- 10% bonus on first deposit
- Minimum deposit amount of 100 ETB

These can be modified directly in the database by updating the `referral_settings` table.

## API Endpoints

- `POST /api/telegram/send-message` - Send a message to a specific Telegram user
- `POST /api/telegram/broadcast` - Broadcast a message to all Telegram users
- `GET /api/telegram/users` - Get all users with Telegram IDs
- `POST /api/telegram/link-account` - Link a user account with Telegram
- `GET /api/telegram/user/:telegramId` - Get user details by Telegram ID
- `GET /api/telegram/user/:telegramId/games` - Get user's game history

## Admin Panel Integration

The Telegram mini-app is integrated with the main admin panel, allowing administrators to:

1. View a list of all Telegram users
2. Send messages to individual users or broadcast to all users
3. Track user engagement through the Telegram interface

## File Structure

- `index.js` - Main bot application file
- `server.js` - Mini app static file server
- `public/` - Static files for the mini app
- `config/` - Configuration files (database connection, etc.)
- `routes/` - API routes
- `migrations/` - Database migration scripts
  - `add-referral-system.js` - Referral system migration script

## Creating a Telegram Bot

To create a Telegram bot for this application:

1. Talk to the [BotFather](https://t.me/botfather) on Telegram
2. Use the `/newbot` command to create a new bot
3. Choose a name and username for your bot
4. Get the bot token and add it to your `.env` file
5. Use BotFather's `/setdomain` command to set the domain for your mini app

## Troubleshooting

- If the bot doesn't respond, check if the `BOT_TOKEN` is correct in the `.env` file
- If users can't access the mini app, verify that the `WEBAPP_URL` is correct and accessible
- For database connection issues, verify the database credentials in the `.env` file
