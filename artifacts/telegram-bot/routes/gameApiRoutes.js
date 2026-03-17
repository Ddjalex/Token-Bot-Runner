const express = require("express");
const router = express.Router();
const db = require("../config/db");

const activeGames = new Map();

function generateBingoCard() {
  const card = [];
  const ranges = [
    [1, 15], [16, 30], [31, 45], [46, 60], [61, 75]
  ];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const nums = [];
    while (nums.length < 5) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(n)) nums.push(n);
    }
    card.push(nums);
  }
  // card[col][row] — transpose to card[row][col]
  const grid = [];
  for (let row = 0; row < 5; row++) {
    grid.push(card.map(col => col[row]));
  }
  grid[2][2] = 0; // FREE space
  return grid;
}

function generateCallSequence() {
  const nums = [];
  for (let i = 1; i <= 75; i++) nums.push(i);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

function checkBingo(markedSet, grid) {
  markedSet.add(0); // FREE space always marked
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push(grid[r]);
  for (let c = 0; c < 5; c++) lines.push(grid.map(row => row[c]));
  lines.push([0,1,2,3,4].map(i => grid[i][i]));
  lines.push([0,1,2,3,4].map(i => grid[i][4-i]));
  for (const line of lines) {
    if (line.every(n => markedSet.has(n))) return true;
  }
  return false;
}

router.get("/user-info", async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) return res.status(400).json({ success: false, message: "telegramId required" });
    const [rows] = await db.execute(
      "SELECT id, username, first_name, phone_number, balance FROM users WHERE telegram_id = ?",
      [telegramId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found. Please register via the bot first." });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/settings", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT setting_key, setting_value FROM game_settings");
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/start-game", async (req, res) => {
  try {
    const { telegramId, betAmount } = req.body;
    if (!telegramId || !betAmount) return res.status(400).json({ success: false, message: "telegramId and betAmount required" });

    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return res.status(400).json({ success: false, message: "Invalid bet amount" });

    const [rows] = await db.execute(
      "SELECT id, balance FROM users WHERE telegram_id = ?",
      [telegramId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });

    const user = rows[0];
    if (parseFloat(user.balance) < bet) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Your balance: ${parseFloat(user.balance).toFixed(2)} ETB` });
    }

    await db.execute("UPDATE users SET balance = balance - ? WHERE id = ?", [bet, user.id]);
    await db.execute(
      "INSERT INTO transactions (user_id, transaction_type, payment_method, amount, status) VALUES (?, 'game_entry', 'system', ?, 'completed')",
      [user.id, bet]
    );

    const card = generateBingoCard();
    const callSequence = generateCallSequence();
    const gameId = `${telegramId}_${Date.now()}`;
    activeGames.set(gameId, { telegramId, userId: user.id, bet, card, callSequence, started: Date.now() });

    const [[updated]] = await db.execute("SELECT balance FROM users WHERE id = ?", [user.id]);

    res.json({
      success: true,
      gameId,
      card,
      callSequence,
      newBalance: parseFloat(updated.balance).toFixed(2)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/claim-win", async (req, res) => {
  try {
    const { gameId, markedNumbers } = req.body;
    if (!gameId || !markedNumbers) return res.status(400).json({ success: false, message: "gameId and markedNumbers required" });

    const game = activeGames.get(gameId);
    if (!game) return res.status(404).json({ success: false, message: "Game not found or already claimed" });

    const markedSet = new Set(markedNumbers.map(Number));
    const won = checkBingo(markedSet, game.card);
    if (!won) return res.status(400).json({ success: false, message: "No bingo detected. Keep playing!" });

    activeGames.delete(gameId);

    const prize = parseFloat((game.bet * 2).toFixed(2));
    await db.execute("UPDATE users SET balance = balance + ? WHERE id = ?", [prize, game.userId]);
    await db.execute(
      "INSERT INTO transactions (user_id, transaction_type, payment_method, amount, status) VALUES (?, 'game_win', 'system', ?, 'completed')",
      [game.userId, prize]
    );

    const [[updated]] = await db.execute("SELECT balance FROM users WHERE id = ?", [game.userId]);

    res.json({
      success: true,
      prize,
      newBalance: parseFloat(updated.balance).toFixed(2),
      message: `🎉 BINGO! You won ${prize} ETB!`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
