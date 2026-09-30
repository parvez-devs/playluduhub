#!/usr/bin/env sh
# PLAY LUDU HUB v12 — manual payment mode
# Copy to config.sh, chmod 600, then: source ./config.sh
# Never commit config.sh or real credentials.

export NODE_ENV='production'
export PORT='8080'
export PUBLIC_BASE_URL='https://example.com'

# Generate long random secrets. Do not reuse passwords.
export SESSION_SECRET='replace-with-at-least-32-random-bytes'
export ADMIN_PIN='replace-with-a-long-random-pin'
export ADMIN_LOCK_MS='1800000'
export ADMIN_SESSION_TTL_MS='28800000'

# Telegram is the primary manual approval console.
export TELEGRAM_BOT_TOKEN=''
export TELEGRAM_CHAT_ID=''
# Comma-separated numeric Telegram user IDs allowed to approve/reject.
export TELEGRAM_ADMIN_IDS=''

# SQLite + backups
export DB_PATH='./data/db.sqlite'
export BACKUP_DIR='./data/backups'

# Set 1 only behind a trusted reverse proxy that overwrites forwarding headers.
export TRUST_PROXY='0'


# Phone OTP verification (Twilio Verify v2)
# Create a Verify Service in Twilio, then set either API Key/Secret or Account SID/Auth Token.
export TWILIO_VERIFY_SERVICE_SID=''
export TWILIO_ACCOUNT_SID=''
export TWILIO_AUTH_TOKEN=''
# Recommended alternative to Account SID/Auth Token:
export TWILIO_API_KEY=''
export TWILIO_API_SECRET=''

# Development only. Never set OTP_DEV_CODE in production.
export OTP_DEV_CODE=''
