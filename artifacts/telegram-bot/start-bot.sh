#!/bin/bash
set -e

MYSQL_SOCK="/home/runner/mysql-run/mysql.sock"
MAX_WAIT=60
COUNTER=0

echo "Waiting for MySQL to be ready..."
until mysqladmin --socket="$MYSQL_SOCK" -u root ping --silent 2>/dev/null; do
  COUNTER=$((COUNTER + 1))
  if [ $COUNTER -ge $MAX_WAIT ]; then
    echo "ERROR: MySQL did not start within ${MAX_WAIT} seconds"
    exit 1
  fi
  sleep 1
done

echo "MySQL is ready. Setting up database..."
mysql --socket="$MYSQL_SOCK" -u root -e "CREATE DATABASE IF NOT EXISTS bingo_db;"

echo "Running migrations..."
cd /home/runner/workspace/artifacts/telegram-bot
node migrations/initial-setup.js 2>&1 || true
node migrations/add-payment-tables.js 2>&1 || true
node migrations/add-phone-number.js 2>&1 || true
node migrations/add-telegram-fields.js 2>&1 || true
node migrations/add-referral-system.js 2>&1 || true

echo "Starting Telegram bot..."
exec node index.js
