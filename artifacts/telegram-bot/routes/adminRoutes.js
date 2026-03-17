const express = require("express");
const router = express.Router();
const db = require("../config/db");

const checkApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ success: true, apiKey: process.env.API_KEY });
  }
  return res.status(401).json({ success: false, message: "Invalid credentials" });
});

router.get("/users", checkApiKey, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let query, countQuery, params, countParams;
    if (search) {
      const like = `%${search}%`;
      query = `SELECT id, telegram_id, username, first_name, last_name, phone_number, balance, is_banned, created_at
               FROM users
               WHERE username LIKE ? OR phone_number LIKE ? OR CAST(telegram_id AS CHAR) LIKE ?
               ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      params = [like, like, like];
      countQuery = "SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR phone_number LIKE ? OR CAST(telegram_id AS CHAR) LIKE ?";
      countParams = [like, like, like];
    } else {
      query = `SELECT id, telegram_id, username, first_name, last_name, phone_number, balance, is_banned, created_at
               FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      params = [];
      countQuery = "SELECT COUNT(*) as total FROM users";
      countParams = [];
    }

    const [rows] = await db.execute(query, params);
    const [[{ total }]] = await db.execute(countQuery, countParams);

    res.json({ success: true, data: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/transactions", checkApiKey, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [rows] = await db.execute(
      `SELECT t.*, u.username, u.phone_number FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await db.execute("SELECT COUNT(*) as total FROM transactions");
    res.json({ success: true, data: rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/withdrawals", checkApiKey, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [rows] = await db.execute(
      `SELECT wr.*, u.username, u.phone_number, u.telegram_id FROM withdrawal_requests wr
       LEFT JOIN users u ON wr.user_id = u.id
       ORDER BY wr.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await db.execute("SELECT COUNT(*) as total FROM withdrawal_requests");
    res.json({ success: true, data: rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/withdrawals/:id/process", checkApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote, transactionNumber } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "Status required" });

    await db.execute(
      "UPDATE withdrawal_requests SET status = ?, notes = ? WHERE id = ?",
      [status, adminNote ? `${transactionNumber ? transactionNumber + ': ' : ''}${adminNote}` : transactionNumber || null, id]
    );

    if (status === "approved") {
      const [rows] = await db.execute("SELECT * FROM withdrawal_requests WHERE id = ?", [id]);
      if (rows.length > 0) {
        const wr = rows[0];
        await db.execute(
          "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
          [wr.amount, wr.user_id, wr.amount]
        );
        await db.execute(
          "INSERT INTO transactions (user_id, type, payment_method, amount, status) VALUES (?, 'withdrawal', ?, ?, 'completed')",
          [wr.user_id, wr.payment_method, wr.amount]
        );
      }
    }

    res.json({ success: true, message: `Withdrawal ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/users/:id/block", checkApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;
    await db.execute("UPDATE users SET is_banned = ? WHERE id = ?", [isBlocked ? 1 : 0, id]);
    res.json({ success: true, message: `User ${isBlocked ? "blocked" : "unblocked"}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/users/:id/balance", checkApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;
    if (!amount) return res.status(400).json({ success: false, message: "Amount required" });
    await db.execute("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, id]);
    await db.execute(
      "INSERT INTO transactions (user_id, type, payment_method, amount, status, notes) VALUES (?, 'bonus', 'system', ?, 'completed', ?)",
      [id, amount, note || "Manual admin adjustment"]
    );
    res.json({ success: true, message: "Balance updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/payment-settings", checkApiKey, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM payment_settings");
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/payment-settings", checkApiKey, async (req, res) => {
  try {
    const { method_name, account_number, account_name, status } = req.body;
    if (!method_name) return res.status(400).json({ success: false, message: "method_name required" });

    const [existing] = await db.execute(
      "SELECT id FROM payment_settings WHERE method_name = ?",
      [method_name]
    );
    if (existing.length > 0) {
      await db.execute(
        "UPDATE payment_settings SET account_number = ?, account_name = ?, status = ? WHERE method_name = ?",
        [account_number, account_name, status, method_name]
      );
    } else {
      await db.execute(
        "INSERT INTO payment_settings (method_name, account_number, account_name, status) VALUES (?, ?, ?, ?)",
        [method_name, account_number, account_name, status]
      );
    }
    res.json({ success: true, message: "Payment settings saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/game-settings", checkApiKey, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT setting_key, setting_value FROM game_settings");
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/game-settings", checkApiKey, async (req, res) => {
  try {
    const fields = req.body;
    for (const [key, value] of Object.entries(fields)) {
      await db.execute(
        "INSERT INTO game_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [key, String(value), String(value)]
      );
    }
    res.json({ success: true, message: "Game settings saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/stats", checkApiKey, async (req, res) => {
  try {
    const [[userCount]] = await db.execute("SELECT COUNT(*) as total FROM users");
    const [[txCount]] = await db.execute("SELECT COUNT(*) as total, COALESCE(SUM(amount),0) as volume FROM transactions WHERE status='completed'");
    const [[pendingW]] = await db.execute("SELECT COUNT(*) as total FROM withdrawal_requests WHERE status='pending'");
    const [[totalBalance]] = await db.execute("SELECT COALESCE(SUM(balance),0) as total FROM users");
    res.json({
      success: true,
      data: {
        users: userCount.total,
        transactions: txCount.total,
        volume: txCount.volume,
        pendingWithdrawals: pendingW.total,
        totalBalance: totalBalance.total,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
