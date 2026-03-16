const express = require("express");
const router = express.Router();
const db = require("../config/db");
const path = require("path");

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
    const [rows] = await db.execute(
      "SELECT id, username, phone_number, telegram_id, balance, isBlocked, created_at FROM users ORDER BY created_at DESC LIMIT 200"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/transactions", checkApiKey, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.*, u.username, u.phone_number FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/withdrawals", checkApiKey, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT wr.*, u.username, u.phone_number, u.telegram_id FROM withdrawal_requests wr
       LEFT JOIN users u ON wr.user_id = u.id
       ORDER BY wr.created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: rows });
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
      "UPDATE withdrawal_requests SET status = ?, admin_note = ?, admin_transaction_number = ? WHERE id = ?",
      [status, adminNote || null, transactionNumber || null, id]
    );

    if (status === "completed") {
      const [rows] = await db.execute("SELECT * FROM withdrawal_requests WHERE id = ?", [id]);
      if (rows.length > 0) {
        const wr = rows[0];
        await db.execute(
          "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?",
          [wr.amount, wr.user_id, wr.amount]
        );
        await db.execute(
          "INSERT INTO transactions (user_id, transaction_type, payment_method, amount, status) VALUES (?, 'withdrawal', ?, ?, 'completed')",
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
    const { isBlocked, reason } = req.body;
    await db.execute("UPDATE users SET isBlocked = ?, blocked_reason = ? WHERE id = ?", [
      isBlocked ? 1 : 0,
      reason || null,
      id,
    ]);
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
      "INSERT INTO transactions (user_id, transaction_type, payment_method, amount, status) VALUES (?, 'manual_deposit', 'system', ?, 'completed')",
      [id, amount]
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
    const { payment_method, account_number, account_name, status } = req.body;
    const [existing] = await db.execute(
      "SELECT id FROM payment_settings WHERE payment_method = ?",
      [payment_method]
    );
    if (existing.length > 0) {
      await db.execute(
        "UPDATE payment_settings SET account_number = ?, account_name = ?, status = ? WHERE payment_method = ?",
        [account_number, account_name, status, payment_method]
      );
    } else {
      await db.execute(
        "INSERT INTO payment_settings (payment_method, account_number, account_name, status) VALUES (?, ?, ?, ?)",
        [payment_method, account_number, account_name, status]
      );
    }
    res.json({ success: true, message: "Payment settings saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/game-settings", checkApiKey, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM game_settings WHERE id = 1");
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/game-settings", checkApiKey, async (req, res) => {
  try {
    const { min_deposit_amount, min_withdrawal_amount, welcome_bonus_amount, welcome_bonus_enabled, welcome_bonus_max_users } = req.body;
    await db.execute(
      `INSERT INTO game_settings (id, min_deposit_amount, min_withdrawal_amount, welcome_bonus_amount, welcome_bonus_enabled, welcome_bonus_max_users)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE min_deposit_amount=VALUES(min_deposit_amount), min_withdrawal_amount=VALUES(min_withdrawal_amount),
       welcome_bonus_amount=VALUES(welcome_bonus_amount), welcome_bonus_enabled=VALUES(welcome_bonus_enabled),
       welcome_bonus_max_users=VALUES(welcome_bonus_max_users)`,
      [min_deposit_amount || 0, min_withdrawal_amount || 0, welcome_bonus_amount || 0, welcome_bonus_enabled ? 1 : 0, welcome_bonus_max_users || 0]
    );
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
