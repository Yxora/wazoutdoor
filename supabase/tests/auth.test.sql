-- Écritures réservées aux comptes (migration 20261023090000_auth.sql).
-- Lancer avec `supabase test db` sur une base locale (`supabase start`), jamais sur la base de production.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Deux comptes de test, supprimés au rollback
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'julie@exemple.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'marc@exemple.fr');

-- Un signalement existant, créé hors RLS
insert into public.signalisations (id, type, lat, lng)
values ('11111111-1111-1111-1111-111111111111', 'arbre', 48.05, 7.02);

-- Sans compte (clé anon)
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ insert into public.signalisations (type, lat, lng) values ('arbre', 48, 7) $$,
  '42501', null, 'anon ne peut pas signaler'
);
select throws_ok(
  $$ select public.confirm_signalisation('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'anon ne peut pas confirmer'
);
select is(
  (select count(*) from public.signalisations)::int, 1, 'anon lit toujours les signalements'
);

-- Session anonyme Supabase (au cas où la connexion anonyme serait activée)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":true}', true);

select throws_ok(
  $$ insert into public.signalisations (type, lat, lng) values ('arbre', 48, 7) $$,
  '42501', null, 'une session anonyme ne peut pas signaler'
);

-- Compte email
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}', true);

select lives_ok(
  $$ insert into public.signalisations (type, lat, lng) values ('boue', 48, 7) $$,
  'un compte peut signaler'
);
select is(
  (select user_id from public.signalisations where type = 'boue'),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'le signalement est rattaché au compte'
);
select throws_ok(
  $$ insert into public.signalisations (type, lat, lng, user_id)
     values ('neige', 48, 7, '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'un compte ne peut pas signaler au nom d’un autre'
);
select is(
  (select gone_votes from public.report_signalisation_gone('11111111-1111-1111-1111-111111111111')),
  1, 'un compte peut voter « Plus là »'
);

select * from finish();
rollback;
