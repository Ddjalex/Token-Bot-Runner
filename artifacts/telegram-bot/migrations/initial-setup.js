require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const pool = mysql.createPool({
    socketPath: "/home/runner/mysql-run/mysql.sock",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "bingo_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    console.log("Starting migration: Initial database setup...");

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        phone_number VARCHAR(20) UNIQUE,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        telegram_id VARCHAR(50) UNIQUE,
        referral_code VARCHAR(20) UNIQUE,
        referred_by INT DEFAULT NULL,
        isBlocked BOOLEAN DEFAULT FALSE,
        blocked_reason VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log("Created users table");

    console.log("Initial setup migration completed successfully!");
  } catch (error) {
    console.error("Error during migration:", error);
  } finally {
    await pool.end();
  }
}

main();
