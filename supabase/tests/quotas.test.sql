-- Quotas par compte (migration 20261023200000_quotas.sql).
-- Lancer avec `supabase test db` sur une base locale (`supabase start`), jamais sur la base de production.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'julie@exemple.fr');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}', true);

select lives_ok(
  $$ insert into public.signalisations (type, lat, lng) select 'boue', 48, 7 from generate_series(1, 20) $$,
  '20 signalements dans l’heure passent'
);
select throws_ok(
  $$ insert into public.signalisations (type, lat, lng) values ('boue', 48, 7) $$,
  'P0001', 'rate_limited', 'le 21e est refusé'
);
select throws_ok(
  $$ select * from public.account_activity $$,
  '42501', null, 'le journal n’est pas lisible'
);
select throws_ok(
  $$ select public.check_quota('signalement') $$,
  '42501', null, 'check_quota n’est pas appelable directement'
);

select * from finish();
rollback;
