create or replace function public.plh_current_user_id()
returns text language sql stable security invoker set search_path = public, pg_temp as $$
  select id from public.users where auth_user_id = (select auth.uid()) limit 1
$$;
revoke all on function public.plh_current_user_id() from public, anon;
grant execute on function public.plh_current_user_id() to authenticated, service_role;

create index if not exists disputes_match_id_idx on public.disputes(match_id);
create index if not exists disputes_opened_by_idx on public.disputes(opened_by);
create index if not exists matches_winner_id_idx on public.matches(winner_id) where winner_id is not null;
create index if not exists referral_games_user_id_idx on public.referral_games(user_id);
create index if not exists users_referred_by_idx on public.users(referred_by) where referred_by is not null;
