require("dotenv").config();
const mysql = require("mysql2/promise");

// Create MySQL connection pool - use socket for reliable connection
const poolConfig = {
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bingo_db",
  socketPath: "/home/runner/mysql-run/mysql.sock",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(poolConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connection successful");
    connection.release();
  } catch (error) {
    console.error("Error connecting to database:", error);
  }
}

// Call the test function when the file is first loaded
testConnection();

module.exports = pool;
