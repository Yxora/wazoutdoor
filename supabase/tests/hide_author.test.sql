-- L'auteur·rice d'un signalement n'est pas visible (migration 20261023180000_hide_author.sql).
-- Lancer avec `supabase test db` sur une base locale (`supabase start`), jamais sur la base de production.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'julie@exemple.fr');
insert into public.signalisations (id, type, lat, lng, user_id)
values ('11111111-1111-1111-1111-111111111111', 'arbre', 48.05, 7.02, '00000000-0000-0000-0000-00000000000a');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select user_id from public.signalisations $$,
  '42501', null, 'anon ne lit pas user_id'
);
select is((select count(*) from public.signalisations)::int, 1, 'anon lit toujours les autres colonnes');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}', true);
select throws_ok(
  $$ select user_id from public.signalisations $$,
  '42501', null, 'un compte ne lit pas user_id, même le sien'
);
select is(
  (select count(*) from information_schema.parameters
   where specific_schema = 'public' and specific_name like 'confirm_signalisation%'
     and parameter_mode = 'OUT' and parameter_name = 'user_id')::int,
  0, 'confirm_signalisation ne renvoie pas user_id'
);

select * from finish();
rollback;
