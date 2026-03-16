// Migration to add referral system tables and fields to the database
const mysql = require("mysql2/promise");
require("dotenv").config();

async function runMigration() {
  const DB_HOST = process.env.DB_HOST || "localhost";
  const DB_USER = process.env.DB_USER || "root";
  const DB_PASSWORD = process.env.DB_PASSWORD || "";
  const DB_NAME = process.env.DB_NAME || "bingo_bot";

  console.log("Connecting to database...");
  console.log(`Database: ${DB_NAME} at ${DB_HOST}`);

  try {
    // Create connection - use socket if available, otherwise TCP
    const connConfig = {
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      multipleStatements: true,
    };
    const fs = require("fs");
    const socketPath = "/home/runner/mysql-run/mysql.sock";
    if (fs.existsSync(socketPath)) {
      connConfig.socketPath = socketPath;
    } else {
      connConfig.host = DB_HOST;
    }
    const connection = await mysql.createConnection(connConfig);

    console.log("Connected to database. Starting migration...");

    // Add referral code and referred_by fields to users table (if not already present)
    console.log("Adding referral fields to users table...");
    const [cols] = await connection.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
      AND COLUMN_NAME IN ('referral_code', 'referred_by')
    `);
    const existingCols = cols.map((r) => r.COLUMN_NAME);
    if (!existingCols.includes("referral_code")) {
      await connection.execute(`ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) DEFAULT NULL`);
    }
    if (!existingCols.includes("referred_by")) {
      await connection.execute(`ALTER TABLE users ADD COLUMN referred_by INT DEFAULT NULL`);
    }

    // Check if indexes exist before creating them
    const [userIndexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND INDEX_NAME IN ('idx_referral_code', 'idx_referred_by');
    `);

    const existingUserIndexes = userIndexes.map((row) => row.INDEX_NAME);

    if (!existingUserIndexes.includes("idx_referral_code")) {
      await connection.execute(`
        ALTER TABLE users 
        ADD UNIQUE INDEX idx_referral_code (referral_code);
      `);
    }

    if (!existingUserIndexes.includes("idx_referred_by")) {
      await connection.execute(`
        ALTER TABLE users 
        ADD INDEX idx_referred_by (referred_by);
      `);
    }

    // Add foreign key constraint if not exists
    // Need to check first to avoid errors if constraint already exists
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND REFERENCED_TABLE_NAME = 'users'
      AND COLUMN_NAME = 'referred_by';
    `);

    if (constraints.length === 0) {
      console.log("Adding foreign key constraint for referred_by...");
      await connection.execute(`
        ALTER TABLE users 
        ADD CONSTRAINT fk_referred_by FOREIGN KEY (referred_by) 
        REFERENCES users(id) ON DELETE SET NULL;
      `);
    }

    // Create referral_earnings table for tracking referral incentives
    console.log("Creating referral_earnings table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referral_earnings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        referrer_id INT NOT NULL,
        referred_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'completed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create referral_settings table for system configuration
    console.log("Creating referral_settings table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referral_settings (
        id INT PRIMARY KEY DEFAULT 1,
        bonus_percentage DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        min_deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // Insert default referral settings if not exists
    console.log("Adding default referral settings...");
    await connection.execute(`
      INSERT INTO referral_settings (bonus_percentage, min_deposit_amount)
      VALUES (10.00, 100.00)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
    `);

    // Create indexes for performance - check if they exist first
    console.log("Creating indexes for referral tables...");
    const [referralIndexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'referral_earnings' 
      AND INDEX_NAME IN ('idx_referral_earnings_referrer', 'idx_referral_earnings_referred');
    `);

    const existingRefIndexes = referralIndexes.map((row) => row.INDEX_NAME);

    if (!existingRefIndexes.includes("idx_referral_earnings_referrer")) {
      await connection.execute(`
        CREATE INDEX idx_referral_earnings_referrer ON referral_earnings(referrer_id);
      `);
    }

    if (!existingRefIndexes.includes("idx_referral_earnings_referred")) {
      await connection.execute(`
        CREATE INDEX idx_referral_earnings_referred ON referral_earnings(referred_id);
      `);
    }

    // Generate referral codes for existing users
    console.log("Generating referral codes for existing users...");
    await connection.execute(`
      UPDATE users 
      SET referral_code = CONCAT('REF', UPPER(SUBSTRING(UUID(), 1, 8)))
      WHERE referral_code IS NULL;
    `);

    console.log("Migration completed successfully!");
    await connection.end();
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
