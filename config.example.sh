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

# Email OTP verification (free-friendly via Gmail SMTP / any SMTP provider)
# Keep 0 until SMTP credentials are configured, then set 1.
export EMAIL_OTP_REQUIRED='0'
export EMAIL_SMTP_HOST='smtp.gmail.com'
export EMAIL_SMTP_PORT='465'
export EMAIL_SMTP_SECURE='1'
export EMAIL_SMTP_USER=''
# For Gmail, use an App Password here — never your normal Gmail password.
export EMAIL_SMTP_PASS=''
export EMAIL_FROM='PLAY LUDU HUB <your-email@gmail.com>'

# Google OAuth
# Authorized redirect URI:
# https://your-domain.example/api/auth/google/callback
export GOOGLE_CLIENT_ID=''
export GOOGLE_CLIENT_SECRET=''

# Development only. Never set EMAIL_OTP_DEV_CODE in production.
export EMAIL_OTP_DEV_CODE=''
