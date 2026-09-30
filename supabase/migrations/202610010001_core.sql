-- Play Ludu Hub v13 / Supabase Postgres foundation
-- Keeps legacy text user IDs for a safe SQLite -> Postgres cutover.

create extension if not exists pgcrypto;

create or replace function public.plh_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.users (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  username text not null,
  phone text not null unique,
  email text not null,
  password_hash text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','banned')),
  avatar text,
  display_name text,
  self_excluded boolean not null default false,
  cool_off_until timestamptz,
  daily_deposit_limit bigint check (daily_deposit_limit is null or daily_deposit_limit >= 0),
  phone_verified boolean not null default true,
  email_verified boolean not null default false,
  google_sub text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_username_lower_uidx on public.users (lower(username));
create unique index if not exists users_email_lower_uidx on public.users (lower(email));
create index if not exists users_auth_user_idx on public.users(auth_user_id) where auth_user_id is not null;
create index if not exists users_status_idx on public.users(status, created_at desc);

create table if not exists public.wallets (
  user_id text primary key references public.users(id) on delete cascade,
  cash_balance bigint not null default 0 check (cash_balance >= 0),
  winnings_balance bigint not null default 0 check (winnings_balance >= 0),
  locked_balance bigint not null default 0 check (locked_balance >= 0),
  bonus_balance bigint not null default 0 check (bonus_balance >= 0),
  total_deposited bigint not null default 0 check (total_deposited >= 0),
  total_withdrawn bigint not null default 0 check (total_withdrawn >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger (
  id text primary key,
  user_id text not null references public.users(id) on delete restrict,
  type text not null check (type in ('deposit','withdraw_lock','withdraw_paid','withdraw_refund','entry_fee','bet_lock','bet_win','bet_loss','admin_fee','bonus_credit','bonus_used','adjustment')),
  balance_bucket text not null check (balance_bucket in ('cash','winnings','locked','bonus','total_deposited','total_withdrawn')),
  amount bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  ref_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_user_created_idx on public.ledger(user_id, created_at desc);
create index if not exists ledger_ref_idx on public.ledger(ref_id) where ref_id is not null;

create table if not exists public.admin_accounts (
  id text primary key,
  revenue_balance bigint not null default 0 check (revenue_balance >= 0),
  updated_at timestamptz not null default now()
);
insert into public.admin_accounts(id,revenue_balance) values ('main',0) on conflict (id) do nothing;

create table if not exists public.admin_ledger (
  id text primary key,
  type text not null,
  amount bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  ref_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists admin_ledger_created_idx on public.admin_ledger(created_at desc);

create table if not exists public.sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip_hash text,
  user_agent_hash text
);
create index if not exists sessions_user_expiry_idx on public.sessions(user_id, expires_at);

create table if not exists public.admin_sessions (
  id text primary key,
  token_hash text not null unique,
  csrf_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  device_hash text not null
);
create table if not exists public.admin_devices (
  device_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.deposits (
  id text primary key,
  user_id text not null references public.users(id) on delete restrict,
  method text not null check (method in ('bkash','nagad','other')),
  amount bigint not null check (amount > 0),
  transaction_id text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','failed')),
  gateway_ref text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deposits_user_created_idx on public.deposits(user_id, created_at desc);
create index if not exists deposits_status_created_idx on public.deposits(status, created_at desc);

create table if not exists public.withdrawals (
  id text primary key,
  user_id text not null references public.users(id) on delete restrict,
  method text not null check (method in ('bkash','nagad','other')),
  account_number text not null,
  amount bigint not null check (amount > 0),
  fee bigint not null default 0 check (fee >= 0),
  source_bucket text not null check (source_bucket in ('winnings','cash','bonus')),
  status text not null default 'pending' check (status in ('pending','processing','paid','rejected','failed')),
  gateway_ref text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists withdrawals_user_created_idx on public.withdrawals(user_id, created_at desc);
create index if not exists withdrawals_status_created_idx on public.withdrawals(status, created_at desc);

create table if not exists public.payment_methods (
  id text primary key,
  kind text not null check (kind in ('deposit','withdrawal')),
  method text not null check (method in ('bkash','nagad','other')),
  label text not null,
  account_number text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_methods_enabled_idx on public.payment_methods(kind, enabled);

create table if not exists public.matches (
  id text primary key,
  mode text not null default 'pvp',
  player_a_id text not null references public.users(id) on delete restrict,
  player_b_id text references public.users(id) on delete restrict,
  entry_fee bigint not null check (entry_fee >= 0),
  bet_amount bigint not null check (bet_amount >= 0),
  status text not null check (status in ('waiting','active','finished','cancelled','disputed')),
  winner_id text references public.users(id) on delete restrict,
  end_reason text,
  state_json jsonb,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  check (player_b_id is null or player_b_id <> player_a_id)
);
create index if not exists matches_status_created_idx on public.matches(status, created_at desc);
create index if not exists matches_player_a_idx on public.matches(player_a_id, created_at desc);
create index if not exists matches_player_b_idx on public.matches(player_b_id, created_at desc) where player_b_id is not null;

create table if not exists public.match_players (
  match_id text not null references public.matches(id) on delete cascade,
  user_id text not null references public.users(id) on delete restrict,
  seat smallint not null check (seat in (0,1)),
  locked_amount bigint not null default 0 check (locked_amount >= 0),
  timeout_strikes smallint not null default 0 check (timeout_strikes >= 0),
  connected boolean not null default false,
  primary key(match_id,user_id),
  unique(match_id,seat)
);
create index if not exists match_players_user_idx on public.match_players(user_id, match_id);

create table if not exists public.disputes (
  id text primary key,
  match_id text not null references public.matches(id) on delete restrict,
  opened_by text references public.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists disputes_status_created_idx on public.disputes(status, created_at desc);

create table if not exists public.aml_flags (
  id text primary key,
  user_id text not null references public.users(id) on delete restrict,
  kind text not null,
  severity text not null check (severity in ('low','medium','high')),
  ref_id text,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewed','closed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists aml_flags_open_idx on public.aml_flags(status, created_at desc);
create index if not exists aml_flags_user_idx on public.aml_flags(user_id, created_at desc);

create table if not exists public.audit_log (
  id text primary key,
  actor_type text not null,
  actor_id text,
  action text not null,
  target_type text,
  target_id text,
  ip_hash text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_target_idx on public.audit_log(target_type,target_id,created_at desc);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.idempotency_keys (
  scope text not null,
  actor_id text not null,
  key text not null,
  response_status integer,
  response_json jsonb,
  created_at timestamptz not null default now(),
  primary key(scope,actor_id,key)
);
create index if not exists idempotency_created_idx on public.idempotency_keys(created_at);

create table if not exists public.email_verifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  status text not null default 'pending' check (status in ('pending','verified','expired')),
  expires_at timestamptz not null,
  send_count integer not null default 1 check (send_count >= 1),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists email_verifications_user_created_idx on public.email_verifications(user_id,created_at desc);
create table if not exists public.google_oauth_states (state_hash text primary key,expires_at timestamptz not null,created_at timestamptz not null default now());
create table if not exists public.google_signup_sessions (token_hash text primary key,google_sub text not null unique,email text not null,name text not null,avatar text,expires_at timestamptz not null,created_at timestamptz not null default now());

do $$
declare t text;
begin
  foreach t in array array['users','wallets','admin_accounts','admin_devices','deposits','withdrawals','payment_methods','disputes','app_config']
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I',t,t);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.plh_touch_updated_at()',t,t);
  end loop;
end $$;

create or replace function public.plh_reject_ledger_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'ledger is append-only'; end;
$$;
drop trigger if exists ledger_no_update on public.ledger;
drop trigger if exists ledger_no_delete on public.ledger;
create trigger ledger_no_update before update on public.ledger for each row execute function public.plh_reject_ledger_mutation();
create trigger ledger_no_delete before delete on public.ledger for each row execute function public.plh_reject_ledger_mutation();
drop trigger if exists admin_ledger_no_update on public.admin_ledger;
drop trigger if exists admin_ledger_no_delete on public.admin_ledger;
create trigger admin_ledger_no_update before update on public.admin_ledger for each row execute function public.plh_reject_ledger_mutation();
create trigger admin_ledger_no_delete before delete on public.admin_ledger for each row execute function public.plh_reject_ledger_mutation();

create or replace function public.plh_current_user_id()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.users where auth_user_id = (select auth.uid()) limit 1
$$;
revoke all on function public.plh_current_user_id() from public;
grant execute on function public.plh_current_user_id() to authenticated, service_role;

create or replace function public.plh_wallet_post(
  p_user_id text,p_bucket text,p_delta bigint,p_type text,p_ref_id text default null,p_note text default null
) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_current bigint; v_next bigint; v_ledger_id text;
begin
  if p_bucket not in ('cash','winnings','locked','bonus','total_deposited','total_withdrawn') then raise exception 'INVALID_BUCKET'; end if;
  if p_type not in ('deposit','withdraw_lock','withdraw_paid','withdraw_refund','entry_fee','bet_lock','bet_win','bet_loss','admin_fee','bonus_credit','bonus_used','adjustment') then raise exception 'INVALID_LEDGER_TYPE'; end if;
  select case p_bucket when 'cash' then cash_balance when 'winnings' then winnings_balance when 'locked' then locked_balance when 'bonus' then bonus_balance when 'total_deposited' then total_deposited else total_withdrawn end
    into v_current from public.wallets where user_id=p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  v_next := v_current + p_delta;
  if v_next < 0 then raise exception 'INSUFFICIENT_FUNDS'; end if;
  if p_bucket='cash' then update public.wallets set cash_balance=v_next where user_id=p_user_id;
  elsif p_bucket='winnings' then update public.wallets set winnings_balance=v_next where user_id=p_user_id;
  elsif p_bucket='locked' then update public.wallets set locked_balance=v_next where user_id=p_user_id;
  elsif p_bucket='bonus' then update public.wallets set bonus_balance=v_next where user_id=p_user_id;
  elsif p_bucket='total_deposited' then update public.wallets set total_deposited=v_next where user_id=p_user_id;
  else update public.wallets set total_withdrawn=v_next where user_id=p_user_id; end if;
  v_ledger_id := 'led_' || replace(gen_random_uuid()::text,'-','');
  insert into public.ledger(id,user_id,type,balance_bucket,amount,balance_after,ref_id,note)
    values(v_ledger_id,p_user_id,p_type,p_bucket,p_delta,v_next,p_ref_id,p_note);
  return v_next;
end;
$$;
revoke all on function public.plh_wallet_post(text,text,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.plh_wallet_post(text,text,bigint,text,text,text) to service_role;

create or replace function public.plh_wallet_transfer(
  p_user_id text,p_from text,p_to text,p_amount bigint,p_type text,p_ref_id text default null,p_note text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_amount <= 0 then raise exception 'INVALID_TRANSFER'; end if;
  perform public.plh_wallet_post(p_user_id,p_from,-p_amount,p_type,p_ref_id,coalesce(p_note,'') || ' [debit ' || p_from || ']');
  perform public.plh_wallet_post(p_user_id,p_to,p_amount,p_type,p_ref_id,coalesce(p_note,'') || ' [credit ' || p_to || ']');
end;
$$;
revoke all on function public.plh_wallet_transfer(text,text,text,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.plh_wallet_transfer(text,text,text,bigint,text,text,text) to service_role;

alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.admin_ledger enable row level security;
alter table public.sessions enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_devices enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.payment_methods enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.disputes enable row level security;
alter table public.aml_flags enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_config enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.email_verifications enable row level security;
alter table public.google_oauth_states enable row level security;
alter table public.google_signup_sessions enable row level security;

drop policy if exists users_read_self on public.users;
create policy users_read_self on public.users for select to authenticated using (auth_user_id=(select auth.uid()));
drop policy if exists wallets_read_self on public.wallets;
create policy wallets_read_self on public.wallets for select to authenticated using (user_id=(select public.plh_current_user_id()));
drop policy if exists ledger_read_self on public.ledger;
create policy ledger_read_self on public.ledger for select to authenticated using (user_id=(select public.plh_current_user_id()));
drop policy if exists deposits_read_self on public.deposits;
create policy deposits_read_self on public.deposits for select to authenticated using (user_id=(select public.plh_current_user_id()));
drop policy if exists withdrawals_read_self on public.withdrawals;
create policy withdrawals_read_self on public.withdrawals for select to authenticated using (user_id=(select public.plh_current_user_id()));
drop policy if exists match_players_read_own on public.match_players;
create policy match_players_read_own on public.match_players for select to authenticated using (user_id=(select public.plh_current_user_id()));
drop policy if exists matches_read_own on public.matches;
create policy matches_read_own on public.matches for select to authenticated using (player_a_id=(select public.plh_current_user_id()) or player_b_id=(select public.plh_current_user_id()));
drop policy if exists disputes_read_own on public.disputes;
create policy disputes_read_own on public.disputes for select to authenticated using (opened_by=(select public.plh_current_user_id()));
drop policy if exists payment_methods_read_enabled on public.payment_methods;
create policy payment_methods_read_enabled on public.payment_methods for select to authenticated using (enabled=true);

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.users,public.wallets,public.ledger,public.deposits,public.withdrawals,public.payment_methods,public.matches,public.match_players,public.disputes to authenticated;
grant select,insert,update,delete on public.users,public.wallets,public.deposits,public.withdrawals,public.payment_methods,public.matches,public.match_players,public.disputes,public.aml_flags,public.audit_log,public.app_config,public.idempotency_keys,public.sessions,public.admin_sessions,public.admin_devices,public.email_verifications,public.google_oauth_states,public.google_signup_sessions to service_role;
grant select,insert on public.ledger,public.admin_ledger to service_role;
grant select,insert,update on public.admin_accounts to service_role;

comment on table public.wallets is 'All balances are integer paisa. Server/RPC mutations only.';
comment on table public.ledger is 'Append-only wallet ledger. Never update/delete rows.';
comment on table public.matches is 'Persistent server-authoritative PvP match state; Railway remains gameplay authority during cutover.';
