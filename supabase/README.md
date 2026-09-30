# Supabase migration plan — Play Ludu Hub v13

This folder prepares Play Ludu Hub to move persistence from the Railway-local SQLite file to Supabase Postgres without moving dice authority or settlement authority into the browser.

## Target architecture

- Railway: Node server, WebSocket match engine, turn timers, dice/move validation, admin API and Telegram integration.
- Supabase Postgres: users/profile mapping, wallet balances, append-only ledger, deposits, withdrawals, matches, disputes, AML, audit and configuration.
- Supabase Auth, phase 2: optional account/session replacement. The database preserves the current text user IDs and adds auth_user_id UUID, so existing records can migrate before auth cutover.
- Realtime: keep Railway WebSocket for live gameplay. If database notifications are added later, use Supabase Broadcast for lobby/wallet notifications; never make the browser authoritative for dice, moves or settlement.

## Security model

The browser never receives SUPABASE_SECRET_KEY. The secret key belongs only in Railway environment variables. Browser access can use a publishable key after Supabase Auth/direct reads are enabled, with RLS limiting rows to the signed-in user.

Wallet mutation functions plh_wallet_post and plh_wallet_transfer are callable only by service_role. Money is stored as integer paisa (bigint) to avoid floating-point accounting errors. Ledger rows are append-only.

## Safe cutover

1. Create the Supabase project and apply migrations/202610010001_core.sql.
2. Run Supabase security and performance advisors and resolve actionable RLS/index findings.
3. Add SUPABASE_URL and SUPABASE_SECRET_KEY to Railway only — never to public JS or Git.
4. Export SQLite rows, converting epoch-millisecond timestamps to timestamptz and JSON strings to jsonb.
5. Import in dependency order: users, wallets, payment methods, matches, match players, deposits/withdrawals, ledger/admin ledger, audit/AML/disputes/config.
6. Compare counts and accounting invariants. For every wallet bucket, the latest ledger balance_after must equal the wallet balance.
7. Add temporary dual-write/shadow-read behavior in Railway and compare SQLite against Supabase under real traffic.
8. Freeze writes briefly, perform a final delta sync, switch Railway to Supabase, verify balances and matches, then archive SQLite read-only.
9. After database cutover is stable, map accounts to auth.users and retire legacy session/OTP tables.

## Current state

The migration SQL is committed before a live Supabase project is created. Project creation is a billing-capable action and requires explicit organization/cost confirmation through the Supabase connector.