#!/bin/bash
MYSQL_DATA="/tmp/mysql-data"
MYSQL_RUN="/home/runner/mysql-run"

mkdir -p "$MYSQL_RUN"
rm -f "$MYSQL_RUN/mysql.pid" "$MYSQL_RUN/mysql.sock"

# Check if MySQL is properly initialized
if [ ! -f "$MYSQL_DATA/ibdata1" ]; then
  echo "Initializing fresh MySQL data directory..."
  rm -rf "$MYSQL_DATA"
  mkdir -p "$MYSQL_DATA"
  mysqld --initialize-insecure --datadir="$MYSQL_DATA" --user=runner 2>&1
fi

echo "Starting MySQL server..."
exec mysqld \
  --datadir="$MYSQL_DATA" \
  --socket="$MYSQL_RUN/mysql.sock" \
  --pid-file="$MYSQL_RUN/mysql.pid" \
  --port=3306 \
  --bind-address=127.0.0.1 \
  --mysqlx=OFF \
  --console
