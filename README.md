# 🎲 PLAY LUDU HUB v12

**Server-authoritative 2-player PvP Ludo with manual bKash/Nagad payments, Telegram approvals, SQLite ledger, Admin Hub, WebSocket gameplay, AML controls, and Termux/VPS deployment.**

> Current payment mode: **MANUAL**  
> No bKash/Nagad gateway API, API key, payout API, or payment webhook is required.
>
> **Balance rule:** New PvP winnings are credited directly to the player's **Main/Cash Balance**. The separate winnings bucket is kept only for legacy compatibility.

### Premium UI merge

The current v12 frontend has been upgraded using the uploaded **v11 Premium Merge** as the visual/UX reference while keeping the v12 backend contracts intact.

- premium dark mobile player shell with drawer + bottom navigation;
- premium wallet/deposit/withdraw cards for manual bKash/Nagad operation;
- premium PvP lobby and match cards;
- premium PvP arena with boot splash, classic board colors, large dice, circular timer, glowing legal-token indicators, chat/events and waiting-match cancellation;
- premium responsive Admin Control Center;
- money, dice, moves, timeout decisions and settlement remain server-authoritative.

The old v11 client-side/local game logic is **not** used for real-money PvP settlement. The v12 server remains the source of truth.


### V5 game replacement

The previous v12 canvas game screen has been removed. The current `/game` frontend is a vanilla-JS server-authoritative adaptation of the operator-supplied `play-ludu-hub-termux-v5-premium.zip` game presentation.

- 15×15 LibreLudo-style board geometry;
- opposite **Blue + Green** seats for 2-player PvP;
- pawn/pin-style token presentation;
- V5 playable-token bounce and rotating-dot indicator;
- shared premium dice station and rolling animation;
- waiting-match overlay, timeout display, chat, dispute and cancel controls;
- no React/Vite runtime/build step is required on the production server;
- uploaded local RNG/bot/save-state logic is not authoritative for paid PvP; v12 Node/WebSocket logic remains authoritative.

A source/license notice is kept at `public/game/V5_SOURCE_NOTICE.txt`.

---

## Performance / stability pass

The current branch includes a mobile/Termux optimization and reliability pass:

- game tokens move with GPU-friendly `translate3d` instead of repeated `left/top` layout writes;
- playable-token indicator uses one lightweight rotating indicator instead of many independent animations;
- overlapping tokens receive small stack offsets so pieces do not hide behind one another;
- dice/move actions are client-debounced to prevent accidental double sends;
- WebSocket UI renders are coalesced with `requestAnimationFrame`;
- the visible timer only updates when its displayed second changes;
- low-memory / low-core Android devices automatically use a lighter visual mode;
- session `last_seen_at` is throttled to one SQLite write per minute instead of every authenticated request;
- local/development SQLite uses WAL + `synchronous=NORMAL`; production keeps `FULL` durability;
- WebSocket heartbeat cleans dead connections;
- disconnect loss uses configurable `disconnectGraceSeconds` (default 15 seconds);
- timeout strikes are restored after reconnect;
- waiting matches auto-cancel and unlock funds after configurable `waitingMatchTtlMinutes` (default 60 minutes);
- self-excluded players remain blocked from new gaming/deposits but may still request withdrawal of existing funds;
- deposit transaction IDs cannot be replayed after a rejected request.

## 1. Current production flow

### Account

```text
Signup
  ↓
Account = pending
  ↓
Telegram/Admin Hub
  ├─ Approve → account = approved
  └─ Reject  → account = rejected
```

Passwords are hashed with Node.js `scrypt`. Player sessions are server-side and last 30 days by default.

### Manual deposit

```text
Player sees operator bKash/Nagad number
  ↓
Player sends money manually
  ↓
Player submits amount + TxID
  ↓
Telegram receives request
  ↓
Admin checks bKash/Nagad statement
  ├─ ✅ Verified
  │    ↓
  │  cashBalance += amount
  │    ↓
  │  ledger deposit posting
  │
  └─ ❌ Reject
       ↓
     no balance change
```

**Important:** pressing `Verified` means the operator has already checked the real transaction.  
The backend also rejects a duplicate non-rejected transaction ID for the same payment method.

### PvP match

Example:

- Entry fee: **৳5**
- Bet: **৳100**
- Each player locks: **৳105**
- Total escrow: **৳210**

```text
Player A creates match
cash -105 → locked +105

Player B joins
cash -105 → locked +105

Server starts authoritative Ludo
  ↓
Winner decided by server
  ↓
Admin revenue = ৳10
Winner main/cash balance += ৳200
Loser receives = ৳0
```

Settlement is atomic. If the financial transaction fails, the database transaction rolls back.

### Manual withdrawal

```text
Player requests withdrawal
  ↓
Main/Cash Balance → lockedBalance
  ↓
Telegram receives number + amount
  ↓
Admin manually sends bKash/Nagad payment
  ↓
Admin presses ✅ Paid
  ↓
lockedBalance is finalized
totalWithdrawn is updated
ledger is written
```

If admin presses `Reject`, the full locked amount returns to the original source balance. New withdrawals default to Main/Cash Balance.

If a withdrawal fee is configured:

```text
Request: ৳200
Fee: 2% = ৳4
Admin manually sends: ৳196
Operator fee revenue: ৳4
```

---

## 2. Telegram approval console

Telegram handles day-to-day decisions:

| Event | Telegram actions |
|---|---|
| New account | Approve / Reject |
| Deposit | **Verified / Reject** |
| Withdrawal | **Paid / Reject** |
| Dispute | Resolve / Reject |

Only Telegram IDs listed in `TELEGRAM_ADMIN_IDS` can make decisions.

After a decision:

- the Telegram message is edited with the final status;
- inline buttons are removed;
- the deciding Telegram admin ID is shown;
- the same backend decision path used by Admin Hub runs;
- an audit record is created.

For deposits, **check the TxID first**.  
For withdrawals, **send the money first, then press Paid**.

---

## 3. Wallet + ledger model

All money is stored as **integer paisa**.

```text
৳1.00 = 100 database units
```

Wallet buckets:

- `cash_balance` — verified deposited money
- `cash_balance` — main balance: verified deposits + new PvP winnings
- `winnings_balance` — legacy compatibility bucket; new PvP wins are no longer credited here
- `locked_balance` — match/withdrawal escrow
- `bonus_balance` — promotional balance
- `total_deposited`
- `total_withdrawn`

Rules:

1. cash/winnings/locked/bonus cannot go negative.
2. every wallet mutation has a matching ledger posting.
3. transfers create debit + credit legs.
4. ledger/admin ledger are append-only.
5. match settlement is atomic.
6. duplicate money requests are protected with `Idempotency-Key`.
7. manual payment decisions record the approving actor.

---

## 4. Server-authoritative Ludo

The browser does **not** decide:

- dice values
- whose turn it is
- legal token movement
- captures
- winner
- wallet settlement

The server uses `crypto.randomInt(1, 7)` for dice generation.

Implemented rules:

- 4 tokens per player
- 6 required to leave yard
- safe cells
- capture
- home lane
- exact-roll finish
- 3 consecutive sixes = turn forfeited
- optional extra turn on six
- optional extra turn on capture
- configurable turn deadline
- configurable timeout strikes
- optional disconnect loss

Client actions carry the last known state revision. A stale action is rejected with `STALE_STATE`.

---

## 5. WebSocket protocol

Endpoint:

```text
/ws
```

Client → server:

```json
{"type":"join_match","matchId":"match_..."}
{"type":"roll_dice","matchId":"match_...","expectedState":12}
{"type":"move_token","matchId":"match_...","tokenId":2,"expectedState":13}
{"type":"chat","matchId":"match_...","text":"gg"}
```

Server → client:

```json
{"type":"state","state":{}}
{"type":"dice","value":6,"by":"usr_..."}
{"type":"move","tokenId":2,"path":[]}
{"type":"turn","playerId":"usr_...","deadline":1780000000000}
{"type":"end","winnerId":"usr_...","reason":"completed"}
{"type":"error","code":"STALE_STATE"}
```

The browser automatically reconnects and requests the authoritative state again.

---

## 6. Admin Hub

URL:

```text
/adminhub
```

Features:

- PIN login
- 3 wrong PIN attempts → 30-minute device/browser lock
- 8-hour admin session by default
- CSRF protection
- pending account approvals
- manual deposit verification
- manual withdrawal confirmation
- user search
- balance adjustment with ledger record
- user ban
- live/disputed match viewer
- force-end match
- bKash/Nagad number management
- gameplay/payment configuration
- AML queue
- ledger viewer + CSV
- audit log
- local reconciliation report

Telegram and Admin Hub use the **same backend decision functions**.

---

## 7. AML + responsible gaming

KYC is **not part of the current project**.

The current controls include:

- configurable AML threshold
- daily deposit limit
- daily withdrawal limit
- deposit velocity flag
- admin AML report
- self-exclusion
- cool-off
- player daily deposit limit

Check your applicable licensing/compliance obligations before production deployment.

---

## 8. Project structure

```text
server.js
server/
  admin.js
  aml.js
  audit.js
  auth.js
  db.js
  game-engine.js
  ledger.js
  payments.js        # manual deposit/withdraw decisions
  pvp.js
  schema.sql
  telegram.js
  utils.js
  wallet.js
  websocket.js
  scripts/
    backup.js
    check.js
    migrate.js

public/
  index.html
  app.js
  wallet.js
  pvp-lobby.js
  game/
    index.html
    game-engine.js
    pvp-client.js
    style.css
  adminhub/
    index.html
    admin.css
    admin.js
    withdraw.js

config.example.sh
run-termux.sh
package.json
README.md
```

Runtime SQLite files and secrets are intentionally excluded by `.gitignore`.

---

## 9. Environment setup

Copy the template:

```bash
cp config.example.sh config.sh
chmod 600 config.sh
```

Edit `config.sh`:

```sh
export NODE_ENV='production'
export PORT='8080'
export PUBLIC_BASE_URL='https://your-domain.example'

export SESSION_SECRET='LONG_RANDOM_SECRET'
export ADMIN_PIN='LONG_PRIVATE_ADMIN_PIN'

export TELEGRAM_BOT_TOKEN='YOUR_BOT_TOKEN'
export TELEGRAM_CHAT_ID='YOUR_GROUP_OR_CHAT_ID'
export TELEGRAM_ADMIN_IDS='123456789,987654321'

export DB_PATH='./data/db.sqlite'
export BACKUP_DIR='./data/backups'
export TRUST_PROXY='0'
```

There are **no payment gateway credentials** in manual mode.

Never commit `config.sh`, Telegram tokens, session secrets, or the live SQLite database.

---

## 10. First startup

### Termux

```bash
pkg update
pkg install nodejs python make clang git
git clone https://github.com/parvez-devs/playluduhub.git
cd playluduhub

cp config.example.sh config.sh
nano config.sh
chmod 600 config.sh

source ./config.sh
npm install
npm run migrate
npm run check
npm start
```

You can also inspect/use:

```bash
chmod +x run-termux.sh
./run-termux.sh
```

### Linux VPS

```bash
git clone https://github.com/parvez-devs/playluduhub.git
cd playluduhub
npm install

cp config.example.sh config.sh
chmod 600 config.sh
nano config.sh

source ./config.sh
npm run migrate
npm run check
npm start
```

Production should normally run behind Nginx/Caddy with HTTPS.

When a trusted reverse proxy terminates TLS and overwrites forwarding headers:

```sh
export TRUST_PROXY='1'
```

---

## 11. Telegram setup

1. Create a bot using BotFather.
2. Put the bot token in `TELEGRAM_BOT_TOKEN`.
3. Add the bot to the admin group/chat.
4. Set `TELEGRAM_CHAT_ID`.
5. Put authorized human Telegram numeric IDs in `TELEGRAM_ADMIN_IDS`.
6. Restart the Node process.

Only those IDs can operate approval buttons.

---

## 12. Configure bKash/Nagad numbers

Login to:

```text
https://your-domain/adminhub
```

Open **Payment Methods**.

Create entries such as:

```text
kind: deposit
method: bkash
label: bKash Merchant
account: 01XXXXXXXXX
enabled: true
```

and:

```text
kind: deposit
method: nagad
label: Nagad Merchant
account: 01XXXXXXXXX
enabled: true
```

Withdrawal methods can also be configured so the frontend offers the correct method names.

---

## 13. Main configuration

Admin Hub can control:

- `welcomeBonus`
- `bonusWithdrawable`
- `pvpEnabled`
- `entryFee`
- `minBet`
- `maxBet`
- `turnSeconds`
- `timeoutStrikes`
- `extraTurnOnSix`
- `extraTurnOnCapture`
- `minDeposit`
- `maxDeposit`
- `minWithdraw`
- `maxWithdraw`
- `withdrawalFeePercent`
- `dailyWithdrawLimit`
- `dailyDepositLimit`
- `withdrawFromCash`
- `amlThreshold`
- `disconnectLoss`
- `disconnectGraceSeconds`
- `waitingMatchTtlMinutes`
- `appNotice`
- `supportText`

---

## 14. Main REST endpoints

Public/auth:

```text
GET  /api/health
GET  /api/config
GET  /api/payment-methods
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/me
PATCH /api/profile
```

Wallet:

```text
POST /api/deposits
GET  /api/deposits
POST /api/withdrawals
GET  /api/withdrawals
```

PvP:

```text
GET  /api/pvp/open
POST /api/pvp/create
POST /api/pvp/:id/join
POST /api/pvp/:id/cancel
POST /api/pvp/:id/dispute
```

Admin:

```text
POST /api/admin/login
GET  /api/admin/dashboard
GET  /api/admin/pending
GET  /api/admin/users
GET  /api/admin/live-matches
GET  /api/admin/ledger
GET  /api/admin/ledger.csv
GET  /api/admin/audit
GET  /api/admin/aml
GET  /api/admin/reconciliation
GET  /api/admin/payment-methods
POST /api/admin/config
POST /api/admin/payment-methods
POST /api/admin/account/:id/approve
POST /api/admin/account/:id/reject
POST /api/admin/deposit/:id/approve
POST /api/admin/deposit/:id/reject
POST /api/admin/withdrawal/:id/approve
POST /api/admin/withdrawal/:id/reject
POST /api/admin/users/:id/status
POST /api/admin/users/:id/adjust
POST /api/admin/matches/:id/force-end
```

Money-changing client/admin calls use an `Idempotency-Key`.

---

## 15. Reconciliation

Because payment mode is manual, reconciliation compares the **approved/paid request rows** against the **financial ledger**.

Admin Hub → Reconciliation checks:

```text
approved deposit total == cash deposit ledger total
paid withdrawal total  == withdraw-paid ledger total
```

It does not call an external payment provider.

Operators should separately compare these totals with their real bKash/Nagad statement as part of daily operations.

---

## 16. Backup and restore

Create a backup:

```bash
source ./config.sh
npm run backup
```

The backup script uses SQLite's online backup API and retains the newest seven snapshots.

Restore:

```bash
# stop the server first
cp data/backups/db-YYYY-MM-DD....sqlite data/db.sqlite
npm run migrate
npm run check
npm start
```

Before restoring production data, preserve a copy of the current database for investigation.

---

## 17. Useful checks

Syntax:

```bash
npm run check
```

Schema/migration:

```bash
npm run migrate
```

SQLite integrity:

```bash
sqlite3 data/db.sqlite 'PRAGMA integrity_check;'
```

Expected result:

```text
ok
```

---

## 18. Security checklist before launch

- use HTTPS only;
- keep `config.sh` outside Git;
- rotate any token that has ever been posted publicly;
- use a long random `SESSION_SECRET`;
- use a long private Admin PIN;
- restrict Admin Hub at the reverse proxy/VPN level where possible;
- verify Telegram admin IDs carefully;
- never press **Deposit Verified** before checking the real TxID;
- never press **Withdrawal Paid** before actually sending the money;
- reconcile bKash/Nagad statements against the ledger every day;
- test backup restore;
- keep server/OS/Node dependencies updated;
- run an independent security/compliance review before live operation.

---

## 19. Incident handling

### Suspicious/duplicate deposit

1. Do not approve.
2. Check TxID against bKash/Nagad statement.
3. Search existing deposit history.
4. Record the incident in the audit/support process.
5. Approve only after manual verification.

### Wrong withdrawal number / payout not sent

If still pending, **Reject** the withdrawal. Locked funds return to the original source balance.

### Withdrawal already marked Paid incorrectly

Do not make an unlogged direct database edit. Review the ledger/audit trail and use a documented admin adjustment only after confirming the real payment state.

### Disputed PvP match

Open the live/disputed match in Admin Hub, inspect the authoritative state, review the audit trail, then resolve/force-end only with a documented reason.

### Suspected compromise

1. stop the server;
2. preserve DB + logs;
3. rotate session/admin/Telegram secrets;
4. invalidate active sessions as needed;
5. audit ledger and admin actions;
6. restore only from a verified backup;
7. document every corrective financial adjustment.

---

## 20. Future gateway upgrade

The current branch intentionally uses **manual payments only**.

If an approved bKash/Nagad/payment provider API is added later, keep these invariants:

- never credit a deposit before provider verification;
- lock withdrawal funds before payout;
- use provider idempotency keys;
- verify webhook signatures;
- make webhook processing idempotent;
- keep every wallet mutation in the ledger;
- keep Telegram/Admin Hub as auditable operator controls.

Implement the provider as an adapter around `server/payments.js`; do not move payment secrets into frontend JavaScript.

---

## 21. Source of truth

Repository:

**https://github.com/parvez-devs/playluduhub**

Recommended recovery workflow at any time:

```bash
git clone https://github.com/parvez-devs/playluduhub.git
cd playluduhub
cp config.example.sh config.sh
# fill private values
source ./config.sh
npm install
npm run migrate
npm run check
npm start
```

The repository contains source code and schema.  
The live database and secrets are intentionally **not** stored in GitHub.
