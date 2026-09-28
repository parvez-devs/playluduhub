#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "[1/4] Checking Termux packages..."
pkg update -y
pkg install -y nodejs-lts python make clang git
if [ ! -d node_modules ]; then
  echo "[2/4] Installing Node dependencies (better-sqlite3 may compile locally)..."
  npm_config_build_from_source=true npm install
else
  echo "[2/4] node_modules already present"
fi
mkdir -p data/backups
if [ -f ./config.sh ]; then
  # shellcheck disable=SC1091
  . ./config.sh
else
  echo "[3/4] No config.sh found. Copy config.example.sh -> config.sh and set production secrets."
fi
npm run migrate
npm run check
echo "[4/4] Starting server on port ${PORT:-8080}"
exec npm start

