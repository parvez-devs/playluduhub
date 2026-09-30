CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
 phone TEXT NOT NULL UNIQUE, email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','banned')),
 avatar TEXT, display_name TEXT,
 self_excluded INTEGER NOT NULL DEFAULT 0 CHECK(self_excluded IN(0,1)), cool_off_until INTEGER,
 daily_deposit_limit INTEGER, phone_verified INTEGER NOT NULL DEFAULT 1 CHECK(phone_verified IN(0,1)), email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN(0,1)), google_sub TEXT,
 referral_code TEXT UNIQUE, referred_by TEXT REFERENCES users(id),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS wallets(
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 cash_balance INTEGER NOT NULL DEFAULT 0 CHECK(cash_balance>=0),
 winnings_balance INTEGER NOT NULL DEFAULT 0 CHECK(winnings_balance>=0),
 locked_balance INTEGER NOT NULL DEFAULT 0 CHECK(locked_balance>=0),
 bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK(bonus_balance>=0),
 total_deposited INTEGER NOT NULL DEFAULT 0 CHECK(total_deposited>=0),
 total_withdrawn INTEGER NOT NULL DEFAULT 0 CHECK(total_withdrawn>=0),
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger(
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 type TEXT NOT NULL CHECK(type IN ('deposit','withdraw_lock','withdraw_paid','withdraw_refund','entry_fee','bet_lock','bet_win','bet_loss','admin_fee','bonus_credit','bonus_used','adjustment')),
 balance_bucket TEXT NOT NULL CHECK(balance_bucket IN ('cash','winnings','locked','bonus','total_deposited','total_withdrawn')),
 amount INTEGER NOT NULL, balance_after INTEGER NOT NULL CHECK(balance_after>=0),
 ref_id TEXT, note TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON ledger(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger(ref_id);
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END;
CREATE TABLE IF NOT EXISTS admin_accounts(id TEXT PRIMARY KEY, revenue_balance INTEGER NOT NULL DEFAULT 0 CHECK(revenue_balance>=0), updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_ledger(id TEXT PRIMARY KEY,type TEXT NOT NULL,amount INTEGER NOT NULL,balance_after INTEGER NOT NULL CHECK(balance_after>=0),ref_id TEXT,note TEXT,created_at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS admin_ledger_no_update BEFORE UPDATE ON admin_ledger BEGIN SELECT RAISE(ABORT,'admin ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS admin_ledger_no_delete BEFORE DELETE ON admin_ledger BEGIN SELECT RAISE(ABORT,'admin ledger is append-only'); END;
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,ip_hash TEXT,user_agent_hash TEXT);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id,expires_at);
CREATE TABLE IF NOT EXISTS admin_sessions(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,device_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_devices(device_hash TEXT PRIMARY KEY,failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until INTEGER,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS deposits(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),method TEXT NOT NULL,amount INTEGER NOT NULL,transaction_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','failed')),gateway_ref TEXT,admin_note TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_deposits_user_day ON deposits(user_id,created_at);
CREATE TABLE IF NOT EXISTS withdrawals(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),method TEXT NOT NULL,account_number TEXT NOT NULL,amount INTEGER NOT NULL,fee INTEGER NOT NULL DEFAULT 0,source_bucket TEXT NOT NULL CHECK(source_bucket IN('winnings','cash','bonus')),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','paid','rejected','failed')),gateway_ref TEXT,admin_note TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_day ON withdrawals(user_id,created_at);
CREATE TABLE IF NOT EXISTS payment_methods(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN('deposit','withdrawal')),method TEXT NOT NULL CHECK(method IN('bkash','nagad','other')),label TEXT NOT NULL,account_number TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,mode TEXT NOT NULL DEFAULT 'pvp',player_a_id TEXT NOT NULL REFERENCES users(id),player_b_id TEXT REFERENCES users(id),entry_fee INTEGER NOT NULL,bet_amount INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN('waiting','active','finished','cancelled','disputed')),winner_id TEXT REFERENCES users(id),end_reason TEXT,state_json TEXT,revision INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,started_at INTEGER,ended_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status,created_at DESC);
CREATE TABLE IF NOT EXISTS match_players(match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),seat INTEGER NOT NULL CHECK(seat IN(0,1)),locked_amount INTEGER NOT NULL DEFAULT 0,timeout_strikes INTEGER NOT NULL DEFAULT 0,connected INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(match_id,user_id),UNIQUE(match_id,seat));
CREATE TABLE IF NOT EXISTS aml_flags(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,severity TEXT NOT NULL CHECK(severity IN('low','medium','high')),ref_id TEXT,details TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','reviewed','closed')),created_at INTEGER NOT NULL,reviewed_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_aml_open ON aml_flags(status,created_at DESC);
CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,actor_type TEXT NOT NULL,actor_id TEXT,action TEXT NOT NULL,target_type TEXT,target_id TEXT,ip_hash TEXT,details TEXT,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE TABLE IF NOT EXISTS app_config(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency_keys(scope TEXT NOT NULL,actor_id TEXT NOT NULL,key TEXT NOT NULL,response_status INTEGER,response_json TEXT,created_at INTEGER NOT NULL,PRIMARY KEY(scope,actor_id,key));
CREATE TABLE IF NOT EXISTS email_verifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,email TEXT NOT NULL,code_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','verified','expired')),expires_at INTEGER NOT NULL,send_count INTEGER NOT NULL DEFAULT 1,attempt_count INTEGER NOT NULL DEFAULT 0,last_sent_at INTEGER NOT NULL,created_at INTEGER NOT NULL,verified_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS google_oauth_states(state_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS google_signup_sessions(token_hash TEXT PRIMARY KEY,google_sub TEXT NOT NULL UNIQUE,email TEXT NOT NULL,name TEXT NOT NULL,avatar TEXT,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
CREATE TABLE IF NOT EXISTS disputes(id TEXT PRIMARY KEY,match_id TEXT NOT NULL REFERENCES matches(id),opened_by TEXT REFERENCES users(id),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','resolved','rejected')),resolution TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS referrals(
 referrer_id TEXT NOT NULL REFERENCES users(id),
 referred_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 code TEXT NOT NULL,
 games_completed INTEGER NOT NULL DEFAULT 0 CHECK(games_completed>=0),
 rewarded_at INTEGER,
 reward_amount INTEGER NOT NULL DEFAULT 0 CHECK(reward_amount>=0),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(referrer_id,referred_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS referral_games(
 match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(match_id,user_id)
);

