# PLAY LUDU HUB v12

Licensed real-money two-player PvP Ludo reference implementation for Node.js, SQLite, WebSocket, Vanilla HTML/JS, Telegram admin approvals, AML controls, and merchant-gateway deposit/payout workflows.

This package is designed so that money state, match state, and administrative state are server-authoritative. The browser never decides dice values, legal moves, wallet results, settlement winners, or payment status. Production launch still requires mapping the generic merchant adapter in `server/payments.js` to the exact signed request/response contract supplied by your approved bKash/Nagad merchant gateway, plus an independent security/compliance review of the deployed environment.

## File-by-file guide

`package.json` pins the runtime dependencies (`ws`, `better-sqlite3`, `zod`) and exposes `start`, `check`, `migrate`, and `backup` scripts.

`config.example.sh` is the environment template. It intentionally contains no real secrets. Copy it to `config.sh`, restrict it to mode `600`, and populate values outside source control.

`server/db.js` opens SQLite in WAL mode, enables foreign keys, creates all tables/indexes/constraints/triggers, inserts default operator configuration, and exposes configuration helpers. `server/schema.sql` is the same complete schema in standalone SQL form.

`server/ledger.js` is the append-only money posting layer. Every wallet column mutation is paired with a ledger row, all money is stored as integer paisa, and bucket transfers create both the debit and credit legs.

`server/wallet.js` implements match escrow, verified deposits, bonuses, withdrawal locking/finalization/refunds, and audited balance adjustments. It never updates a balance directly without using `server/ledger.js`.

`server/pvp.js` implements match creation, player join, escrow lifecycle, authoritative turn deadlines, timeout strikes, disconnect loss, settlement, disputes, force-end, and crash-time active-match resume.

`server/game-engine.js` is the authoritative Ludo rule engine: four tokens, six to leave yard, 52-cell loop, safe cells, captures, five-cell home lane plus exact finish, three consecutive sixes forfeit the turn, and configurable extra turns on six/capture.

`server/websocket.js` authenticates the HTTP session during the WebSocket upgrade and implements `join_match`, `roll_dice`, `move_token`, chat, reconnect state replay, and room broadcasts.

`server/payments.js` implements deposit requests, merchant verification, payout submission, signed/idempotent gateway requests, signed webhook handling, payout finalization/refund behavior, and gateway reconciliation calls. Do not silently translate a timeout into a refund: an uncertain payout stays `processing` until a definitive webhook/reconciliation result.

`server/aml.js` enforces Bangladesh-time daily limits, threshold flags, deposit velocity flags, and produces the AML review queue.

`server/telegram.js` polls Bot API `getUpdates`, posts account/deposit/withdrawal/dispute events, verifies callback sender IDs against `TELEGRAM_ADMIN_IDS`, and routes Approve/Reject callbacks into the same server-side decision functions used by Admin Hub.

`server/admin.js` provides PIN sessions, three-failure lockout, CSRF tokens, approval actions, user management, balance adjustment, payment-method management, configuration, ledger CSV, audit viewer data, AML data, live-match controls, and daily reconciliation.

`server/auth.js` implements scrypt password hashing, signup, username/phone/email login, server-side 30-day sessions, signed random session tokens, login rotation, and public user shaping.

`server/audit.js` appends administrative/security events to `audit_log`.

`server/utils.js` contains cryptographic, HTTP, cookie, money, filesystem, JSON-body, and password helpers.

`server.js` is the HTTP entry point. It serves the frontend, implements the REST API, rate limits IP/user traffic, applies idempotency to money-changing routes, starts Telegram and WebSocket services, and serves Admin Hub at `/adminhub`.

`public/index.html`, `public/app.js`, `public/wallet.js`, and `public/pvp-lobby.js` implement signup/login, wallet balances, deposit/withdrawal requests, responsible-gaming controls and the PvP lobby.

`public/game/index.html`, `public/game/game-engine.js`, `public/game/pvp-client.js`, and `public/game/style.css` implement the mobile game client. The client is intentionally presentation-only: it draws state and sends intents; it does not own authoritative rules.

`public/adminhub/index.html`, `public/adminhub/admin.js`, and `public/adminhub/withdraw.js` implement the PIN-gated operator UI with pending approvals, users, live matches, payment methods, configuration, ledger, AML, audit, and reconciliation.

`run-termux.sh` installs the Termux build toolchain needed by `better-sqlite3`, installs dependencies, migrates/checks the project, and starts the server.

`server/scripts/migrate.js`, `server/scripts/check.js`, and `server/scripts/backup.js` implement schema initialization, JS syntax checking, and SQLite online backups with seven-file retention.

## Money model and ledger invariants

All monetary values are integer paisa in SQLite. One taka equals `100` database units. JavaScript API responses generally convert user-facing balances back to taka.

The core invariants are:

1. `wallets.cash_balance`, `winnings_balance`, `locked_balance`, and `bonus_balance` can never be negative because of SQL `CHECK` constraints and runtime guards.
2. `ledger` and `admin_ledger` are append-only. SQLite triggers reject `UPDATE` and `DELETE` against those tables.
3. Every changed wallet bucket produces one ledger row containing the signed change and the resulting `balance_after`.
4. A transfer between two user buckets produces two rows in the same SQLite transaction: one negative source posting and one positive destination posting.
5. The last ledger `balance_after` for each bucket must equal the corresponding wallet column; `ledger.assertWallet(userId)` enforces this after money-changing operations.
6. Match settlement either commits completely or does not happen. Both player escrow debits, winner credit, operator entry-fee credit, match winner, and finished state are in the same database transaction.
7. A withdrawal is locked before it is submitted to the gateway. A network timeout is not treated as a payout failure; the funds remain locked until a definitive provider event/reconciliation result exists.
8. Payment webhooks are idempotent through `gateway_events.event_id`.
9. Client money endpoints require an `Idempotency-Key` header. A duplicate key returns the original stored response instead of repeating the money mutation.
10. Lifetime `total_deposited` represents verified deposits; `total_withdrawn` represents external payout value after any configured withdrawal fee.

### Settlement worked example

Assume each player has enough cash, `entryFee = ৳5`, and `betAmount = ৳100`.

At lock time each player moves `৳105` from `cash` to `locked`. The pair therefore has `৳210` escrowed.

When Player A wins:

- Player A locked entry fee: `-৳5`, type `admin_fee`.
- Player B locked entry fee: `-৳5`, type `admin_fee`.
- Operator revenue: `+৳10`.
- Player B locked bet: `-৳100`, type `bet_loss`.
- Player A locked bet: `-৳100`, type `bet_win` (release of Player A's stake from escrow accounting).
- Player A winnings: `+৳200`, type `bet_win`.

Conservation: `৳210 escrow = ৳10 operator + ৳200 winner`.

Relative to the players' pre-match cash, the winner's economic result is `+৳95` (`+৳100 bet result - ৳5 entry fee`) and the loser is `-৳105`.

### Withdrawal worked example

Assume `winningsBalance = ৳500`, the player requests `৳200`, and `withdrawalFeePercent = 2`.

At request time:

- winnings: `-৳200`
- locked: `+৳200`

The gateway payout request is for `৳196`; `৳4` is the operator fee.

When the provider definitively confirms `paid`:

- locked: `-৳196`, type `withdraw_paid`
- locked: `-৳4`, type `admin_fee`
- `totalWithdrawn`: `+৳196`
- operator revenue: `+৳4`

If the provider definitively reports `payout.failed` or an admin rejects a still-pending request, the full `৳200` is moved from `locked` back to its original source bucket.

## SQL schema

The complete executable SQL schema is in `server/schema.sql`. It creates:

- `users`
- `wallets`
- `ledger`
- `admin_accounts`
- `admin_ledger`
- `sessions`
- `admin_sessions`
- `admin_devices`
- `deposits`
- `withdrawals`
- `payment_methods`
- `matches`
- `match_players`
- `aml_flags`
- `audit_log`
- `app_config`
- `idempotency_keys`
- `gateway_events`
- `disputes`
- `schema_migrations`

The SQLite design deliberately uses simple scalar columns, integer money, explicit foreign keys, and ordinary SQL transactions so migration to PostgreSQL is straightforward. For PostgreSQL, replace `better-sqlite3` with `pg`, use `BIGINT` for monetary/timestamp integer columns (or `TIMESTAMPTZ` for timestamps), convert `INSERT OR IGNORE` to `INSERT ... ON CONFLICT DO NOTHING`, and keep all posting/settlement logic at the same transaction boundaries. In production PostgreSQL, use `SELECT ... FOR UPDATE` around wallet/match rows before financial mutations.

## Authentication and security behavior

Passwords use Node's `crypto.scrypt` with a per-password random salt. Login verification remains timing-safe even for unknown accounts by running a fake scrypt verification path.

Player sessions are random signed tokens stored server-side only by hash. Login deletes older sessions for that account and issues a new 30-day token. Browsers receive the token in an HttpOnly, SameSite=Strict cookie; the `Secure` attribute is enabled in production.

Admin Hub uses a separate server-side session with an 8-hour TTL and a per-session CSRF token. Three bad PIN attempts for the current browser/device identity create a 30-minute lock. Browser cookies are not hardware attestation, so production should additionally use reverse-proxy/IP allowlists, VPN/private admin access, or WebAuthn if stronger device binding is required.

All production traffic should terminate TLS before reaching Node. Set `TRUST_PROXY=1` only when your trusted reverse proxy overwrites `X-Forwarded-For` / `X-Forwarded-Proto`.

## WebSocket protocol

Endpoint: `/ws` on the same origin. The browser's authenticated session cookie is validated during the HTTP upgrade.

Client messages:

```json
{"type":"join_match","matchId":"match_...","lastKnownState":12}
```

```json
{"type":"roll_dice","matchId":"match_...","expectedState":12}
```

```json
{"type":"move_token","matchId":"match_...","tokenId":2,"expectedState":13}
```

```json
{"type":"chat","matchId":"match_...","text":"gg"}
```

After a client has joined exactly one room, `matchId` may be omitted from `roll_dice`, `move_token`, or `chat`.

Server messages:

```json
{"type":"state","state":{"revision":13,"turnSeat":0,"rolled":6},"match":{"id":"match_...","status":"active"}}
```

```json
{"type":"dice","value":6,"by":"usr_..."}
```

```json
{"type":"move","tokenId":2,"path":[{"progress":0,"globalCell":0}],"by":"usr_..."}
```

```json
{"type":"turn","playerId":"usr_...","deadline":1780000000000}
```

```json
{"type":"end","winnerId":"usr_...","reason":"completed"}
```

```json
{"type":"error","code":"STALE_STATE"}
```

`expectedState` is the client's last authoritative `revision`. A stale revision is rejected rather than letting an old client action mutate current state.

## REST API

Authentication uses the HttpOnly cookie issued by login. A non-browser client can also send `Authorization: Bearer <token>`.

### Public/auth

`GET /api/health`

Response:

```json
{"ok":true,"version":"12.0.0"}
```

`GET /api/config` returns only public gameplay/limit/notice fields.

`GET /api/payment-methods?kind=deposit` returns enabled merchant display numbers.

`POST /api/auth/signup`

```json
{"name":"Player One","username":"player1","phone":"+8801700000000","email":"p1@example.com","password":"a-long-password"}
```

`POST /api/auth/login`

```json
{"login":"player1","password":"a-long-password"}
```

`POST /api/auth/logout`

`GET /api/me`

`PATCH /api/profile`

```json
{"displayName":"Player One","avatar":"https://cdn.example/avatar.png"}
```

### Responsible gaming

`POST /api/responsible/self-exclude`

`POST /api/responsible/cool-off`

```json
{"hours":24}
```

`POST /api/responsible/deposit-limit`

```json
{"amount":5000}
```

Self-excluded or actively cooling-off users cannot create/join PvP matches or make new deposits.

### Deposit

`POST /api/deposits` — requires `Idempotency-Key`.

```json
{"method":"bkash","amount":500,"transactionId":"TX123456"}
```

`GET /api/deposits`

Admin approval calls the merchant verify API. Wallet cash is credited only after a definitive verified/success response.

### Withdrawal

`POST /api/withdrawals` — requires `Idempotency-Key`.

```json
{"method":"nagad","accountNumber":"01700000000","amount":200,"sourceBucket":"winnings"}
```

`GET /api/withdrawals`

`sourceBucket` may be `winnings`, `cash` when `withdrawFromCash=true`, or `bonus` when `bonusWithdrawable=true`.

### PvP

`GET /api/pvp/open`

`POST /api/pvp/create` — requires `Idempotency-Key`.

```json
{"entryFee":5,"betAmount":100}
```

`POST /api/pvp/:id/join` — requires `Idempotency-Key`.

`POST /api/pvp/:id/cancel` — requires `Idempotency-Key`; only the waiting creator can cancel.

`POST /api/pvp/:id/dispute`

```json
{"reason":"Connection dropped after my move"}
```

### Payment webhook

`POST /api/payment/webhook`

The body must be the gateway's raw JSON and `X-Webhook-Signature` must equal lowercase hex `HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, rawBody)`. Every event needs a globally unique `id` or `eventId`.

Supported normalized events:

```json
{"id":"evt_1","type":"payout.paid","reference":"wd_...","gatewayRef":"gw_..."}
```

```json
{"id":"evt_2","type":"payout.failed","reference":"wd_..."}
```

Map the approved provider's exact webhook names/fields to these normalized values in `server/payments.js` if needed.

### Admin Hub

`POST /api/admin/login`

```json
{"pin":"your-admin-pin"}
```

All mutating Admin Hub requests require the `X-CSRF-Token` returned by login. Money-changing admin routes also require `Idempotency-Key`.

Read endpoints:

- `GET /api/admin/dashboard`
- `GET /api/admin/pending`
- `GET /api/admin/users?q=...`
- `GET /api/admin/live-matches`
- `GET /api/admin/ledger?limit=500`
- `GET /api/admin/ledger.csv`
- `GET /api/admin/audit`
- `GET /api/admin/aml`
- `GET /api/admin/reconciliation?date=YYYY-MM-DD`
- `GET /api/admin/payment-methods`

Mutation endpoints:

- `POST /api/admin/config`
- `POST /api/admin/payment-methods`
- `POST /api/admin/account/:id/approve`
- `POST /api/admin/account/:id/reject`
- `POST /api/admin/deposit/:id/approve`
- `POST /api/admin/deposit/:id/reject`
- `POST /api/admin/withdrawal/:id/approve`
- `POST /api/admin/withdrawal/:id/reject`
- `POST /api/admin/users/:id/status`
- `POST /api/admin/users/:id/adjust`
- `POST /api/admin/matches/:id/force-end`

## Merchant gateway adapter contract

The generic adapter sends JSON to:

- `PAYMENT_VERIFY_PATH` for deposit verification
- `PAYMENT_PAYOUT_PATH` for payouts
- `PAYMENT_RECONCILIATION_PATH` for daily reconciliation

Headers include:

- `Authorization: Bearer PAYMENT_GATEWAY_API_KEY`
- `X-Timestamp: <unix-ms>`
- `X-Signature: HMAC-SHA256(PAYMENT_GATEWAY_SECRET, "<timestamp>.<raw-json-body>")`
- `Idempotency-Key: <stable-operation-key>`

Expected normalized deposit verification response is either:

```json
{"verified":true,"reference":"provider-reference"}
```

or a response whose `status` is `verified` or `success`.

Expected normalized payout response is:

```json
{"status":"paid","reference":"provider-reference"}
```

for an immediate final result, or any non-final success object for asynchronous processing followed by the webhook.

If your provider signs requests differently, change only the private `gateway()` function and response normalization. Do not put provider secrets in browser code.

## Reconciliation

The Admin Hub daily report compares local payment rows with independent ledger postings and also calls the configured gateway reconciliation endpoint.

Useful direct SQLite checks:

```sql
-- Deposits credited to cash during a period
SELECT COALESCE(SUM(amount),0) AS deposit_paisa
FROM ledger
WHERE type='deposit'
  AND balance_bucket='cash'
  AND created_at >= :from_ms
  AND created_at < :to_ms;
```

```sql
-- Verified deposit requests during the same period
SELECT COALESCE(SUM(amount),0) AS approved_deposit_paisa
FROM deposits
WHERE status='approved'
  AND updated_at >= :from_ms
  AND updated_at < :to_ms;
```

```sql
-- Actual external payout amount (net of withdrawal fees)
SELECT COALESCE(-SUM(amount),0) AS payout_paisa
FROM ledger
WHERE type='withdraw_paid'
  AND balance_bucket='locked'
  AND created_at >= :from_ms
  AND created_at < :to_ms;
```

```sql
-- Paid request external value
SELECT COALESCE(SUM(amount-fee),0) AS paid_request_paisa
FROM withdrawals
WHERE status='paid'
  AND updated_at >= :from_ms
  AND updated_at < :to_ms;
```

```sql
-- Any wallet whose latest ledger balance disagrees with the wallet row can be investigated by bucket.
SELECT w.user_id,w.cash_balance,
       (SELECT l.balance_after FROM ledger l
        WHERE l.user_id=w.user_id AND l.balance_bucket='cash'
        ORDER BY l.created_at DESC,l.rowid DESC LIMIT 1) AS ledger_cash
FROM wallets w
WHERE ledger_cash IS NOT NULL AND ledger_cash <> w.cash_balance;
```

A production reconciliation job should compare provider settlement/export totals, provider transaction IDs, local payment request status, ledger cash/locked movements, and bank settlement for the same Dhaka business day. Any mismatch should open an operator incident instead of auto-adjusting a wallet.

## Telegram setup

Create a bot with BotFather, add it to the private operator group, and configure:

```sh
export TELEGRAM_BOT_TOKEN='...'
export TELEGRAM_CHAT_ID='-100...'
export TELEGRAM_ADMIN_IDS='12345,67890'
```

Only Telegram sender IDs in `TELEGRAM_ADMIN_IDS` can execute callback actions. Telegram decisions call the same server-side approval functions as Admin Hub and are audit logged.

## Termux deployment

1. Install Termux from a maintained source and update packages.
2. Extract the project to a private application directory.
3. Copy `config.example.sh` to `config.sh`.
4. Generate strong random values for `SESSION_SECRET`, `ADMIN_PIN`, and `PAYMENT_WEBHOOK_SECRET`.
5. Restrict secrets:

```sh
chmod 600 config.sh
```

6. Run:

```sh
./run-termux.sh
```

`better-sqlite3` may compile from source on Android, which is why `run-termux.sh` installs `python`, `make`, and `clang` and sets `npm_config_build_from_source=true` on first install.

For internet exposure, do not expose the raw Termux Node port directly. Put a trusted TLS reverse proxy/tunnel in front of it, set `PUBLIC_BASE_URL` to the HTTPS origin, and enable `TRUST_PROXY=1` only when the proxy sanitizes forwarding headers.

Termux is useful for controlled operation/testing, but a hardened Linux VPS is the preferred production runtime because service supervision, firewalling, encrypted backups, log shipping, patch management, and availability controls are materially stronger.

## Linux VPS deployment

Example for Ubuntu/Debian:

```sh
sudo apt update
sudo apt install -y nodejs npm build-essential python3 sqlite3
sudo useradd --system --create-home --shell /usr/sbin/nologin luduhub
sudo mkdir -p /opt/play-ludu-hub
sudo chown -R luduhub:luduhub /opt/play-ludu-hub
```

Copy the project to `/opt/play-ludu-hub`, then:

```sh
cd /opt/play-ludu-hub
sudo -u luduhub npm ci --omit=dev
sudo -u luduhub cp config.example.sh config.sh
sudo chmod 600 config.sh
```

Create `/etc/systemd/system/play-ludu-hub.service`:

```ini
[Unit]
Description=PLAY LUDU HUB v12
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=luduhub
Group=luduhub
WorkingDirectory=/opt/play-ludu-hub
Environment=NODE_ENV=production
ExecStart=/bin/bash -lc '. ./config.sh && exec node server.js'
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/play-ludu-hub/data
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Then:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now play-ludu-hub
sudo systemctl status play-ludu-hub
```

Put Caddy/Nginx in front of `127.0.0.1:8080`, proxy WebSocket upgrades, redirect HTTP to HTTPS, and use a valid certificate. Firewall the Node port so it is reachable only locally.

Recommended production controls include: dedicated non-root Unix account, private database directory, off-host encrypted backups, SSH keys only, unattended security updates after testing, firewall allowlists for Admin Hub/VPN where feasible, centralized logs, uptime monitoring, disk-space alerts, and gateway webhook monitoring.

## Daily backup and restore

Create an online SQLite snapshot:

```sh
. ./config.sh
npm run backup
```

The script writes to `BACKUP_DIR` and keeps the newest seven `.sqlite` snapshots.

On a Linux VPS, run the backup script from a systemd timer or cron once per day. Example cron:

```cron
17 3 * * * cd /opt/play-ludu-hub && /bin/bash -lc '. ./config.sh && npm run backup' >> /var/log/play-ludu-hub-backup.log 2>&1
```

Copy the generated backup off-host and encrypt it. Seven local snapshots do not replace off-host disaster recovery.

Restore procedure:

1. Stop the Node service.
2. Copy the current database and WAL/SHM files to a forensic directory; do not destroy them.
3. Validate the chosen backup:

```sh
sqlite3 data/backups/db-YYYY.sqlite 'PRAGMA integrity_check;'
```

4. Replace `data/db.sqlite` with the validated snapshot.
5. Remove stale `db.sqlite-wal` and `db.sqlite-shm` only after the service is stopped and the evidence copy is secured.
6. Start the service.
7. Run ledger/reconciliation checks before reopening money operations.
8. Reconcile every gateway event that occurred after the backup timestamp before accepting new withdrawals.

## Testing checklist

### Unit tests to add/maintain

- scrypt accepts correct password and rejects wrong password.
- signed session token rejects a modified ID/secret/signature.
- money parser rejects negative, NaN, and non-finite values.
- ledger transfer writes exactly two bucket rows and preserves non-negative balances.
- wallet assertion detects a deliberate wallet/ledger mismatch.
- four tokens require six to leave yard.
- a token cannot move past exact finish.
- safe-cell landing never captures.
- unsafe-cell landing captures an opponent token.
- three consecutive sixes advances the turn without a move.
- extra-turn switches correctly for all four configuration combinations.
- stale WebSocket revisions are rejected.
- timeout strike increments and settles to the opponent at configured threshold.
- settlement conserves `2*(entryFee+betAmount)`.
- settlement cannot run twice.
- deposit approval cannot credit twice.
- webhook event cannot process twice.
- withdrawal rejection refunds exactly once.
- payout timeout stays locked/processing instead of refunding prematurely.
- withdrawal fee is credited to operator and only net payout increments `totalWithdrawn`.
- admin third bad PIN locks the device identity.

### Integration tests

- Signup -> Telegram/Admin pending -> approval -> login.
- Two approved users deposit verified funds through a gateway test stub.
- Player A creates -> Player B joins -> both escrow balances exactly match match stakes.
- Play a deterministic instrumented game to completion -> match settlement matches ledger/wallet/admin revenue.
- Kill/restart Node during an active match -> active state reloads and deadline handling resumes.
- Disconnect active player -> reconnect inside grace works; remaining disconnected past grace settles as configured.
- Withdrawal request -> lock -> gateway async success webhook -> paid state and net accounting.
- Withdrawal request -> rejection -> exact source-bucket refund.
- Duplicate client idempotency key returns the original response without a second ledger mutation.
- Duplicate webhook event returns duplicate/no-op behavior.
- Admin CSRF missing/wrong blocks mutation.
- Non-admin Telegram callback sender is rejected.
- Daily Dhaka deposit/withdraw limit boundaries work across midnight UTC+6.

### Manual/security tests

- Mobile Chrome/Firefox rendering at 320px, 360px, 390px, 430px widths.
- Slow 3G reconnect behavior.
- Browser refresh mid-turn.
- Two tabs logged into same match.
- Invalid token ID / repeated roll / out-of-turn move.
- 32 KB WebSocket payload cap.
- SQL injection strings in every text field.
- HTML/script strings in username/chat/admin fields.
- Brute-force admin PIN and player login rate limits.
- Cookie flags over real HTTPS.
- Reverse-proxy source IP handling with and without `TRUST_PROXY`.
- Gateway signature invalid/missing/old timestamp behavior according to provider requirements.
- Full SQLite integrity check after forced process termination.
- Restore latest backup into a clean staging host and perform reconciliation.

Run the included syntax check with:

```sh
npm run check
```

## Incident response

### Match dispute

1. Do not manually edit wallet columns.
2. Freeze/escalate the match using dispute status if it is still active.
3. Preserve `matches.state_json`, `revision`, `match_players`, relevant ledger rows, audit rows, and server logs.
4. Compare the final authoritative state with WebSocket/server logs, not the client UI.
5. If an operator resolution requires financial correction, use an explicit audited adjustment or a purpose-built reversal flow; never rewrite historical ledger rows.
6. Record operator identity, reason, evidence, and final resolution in audit/dispute records.

### Chargeback / reversed deposit

1. Identify the exact gateway reference and local `deposit.id`.
2. Freeze affected withdrawal/game privileges according to your compliance procedure if necessary.
3. Verify the provider's reversal/chargeback status directly; do not rely on a screenshot supplied by a player.
4. Reconcile the original deposit ledger entry, subsequent match spending, winnings, withdrawals, and current balances.
5. Use a new compensating `adjustment`/reversal posting rather than deleting or editing the original deposit ledger row.
6. Escalate AML review where your policy or applicable law requires it.
7. Preserve all provider/webhook/audit evidence for the required retention period.

### Suspected compromise / hack

1. Put the application into a controlled maintenance state at the reverse proxy and disable new deposits/withdrawals/PvP.
2. Do not wipe the server. Snapshot disk/database/logs for forensics.
3. Rotate `SESSION_SECRET`, Admin PIN, Telegram token, gateway API key/secret, webhook secret according to a documented key-rotation plan.
4. Revoke active player/admin sessions.
5. Compare database balances against append-only ledger history and gateway settlement data.
6. Review audit logs, admin sessions, unusual balance adjustments, payout destinations, AML flags, and unexpected webhook IDs.
7. Patch the root cause before reopening.
8. Restore from backup only when necessary; if restoring, replay/reconcile all valid gateway events after the backup point.
9. Notify affected parties/regulators/payment partners according to your legal and contractual incident procedure.
10. Conduct a post-incident review and add a regression test/control for the failure mode.

## Production launch checklist

- Replace all example secrets.
- Set `NODE_ENV=production`.
- Set a 32+ character `SESSION_SECRET`.
- Set a long random `ADMIN_PIN` and restrict Admin Hub network access.
- Configure actual merchant gateway paths and signing/payload normalization.
- Configure and verify webhook signatures over the raw body.
- Add real bKash/Nagad merchant display numbers in Admin Hub.
- Verify Telegram group/chat/admin IDs.
- Test provider sandbox deposit verification, payout, failure, duplicate callbacks, delayed callbacks, and reconciliation.
- Verify all min/max/daily/AML limits with compliance counsel/operator policy.
- Run TLS-only behind a hardened reverse proxy.
- Run backup + off-host copy + restore drill.
- Run ledger/reconciliation tests before opening real-money traffic.
- Perform an independent penetration/security review and load test.


