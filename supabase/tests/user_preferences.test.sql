-- Préférences par compte (migration 20261023150000_user_preferences.sql).
-- Lancer avec `supabase test db` sur une base locale (`supabase start`), jamais sur la base de production.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'julie@exemple.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'marc@exemple.fr');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}', true);

select lives_ok(
  $$ insert into public.user_preferences (activities, preferences, signalisation_preferences)
     values ('{randonneur}', '{"water":"ignore"}', '{}') $$,
  'un compte enregistre ses préférences'
);
select lives_ok(
  $$ insert into public.user_preferences (user_id, activities, preferences, signalisation_preferences)
     values ('00000000-0000-0000-0000-00000000000a', '{vttiste}', '{}', '{}')
     on conflict (user_id) do update set activities = excluded.activities $$,
  'un compte met à jour ses préférences (upsert)'
);
select throws_ok(
  $$ insert into public.user_preferences (user_id, activities, preferences, signalisation_preferences)
     values ('00000000-0000-0000-0000-00000000000b', '{vttiste}', '{}', '{}') $$,
  '42501', null, 'un compte ne peut pas écrire les préférences d’un autre'
);

-- Un autre compte ne voit rien
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b","is_anonymous":false}', true);
select is((select count(*) from public.user_preferences)::int, 0, 'un compte ne lit pas les préférences d’un autre');

-- Sans compte : aucun accès
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select * from public.user_preferences $$,
  '42501', null, 'anon ne lit pas les préférences'
);

select * from finish();
rollback;
