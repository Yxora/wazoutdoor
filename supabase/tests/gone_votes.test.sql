-- Un vote « Plus là » par compte (migration 20261023120000_gone_votes.sql).
-- Lancer avec `supabase test db` sur une base locale (`supabase start`), jamais sur la base de production.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'julie@exemple.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'marc@exemple.fr');
insert into public.signalisations (id, type, lat, lng)
values ('11111111-1111-1111-1111-111111111111', 'arbre', 48.05, 7.02);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}', true);

select is(
  (select gone_votes from public.report_signalisation_gone('11111111-1111-1111-1111-111111111111')),
  1, 'le premier vote compte'
);
select throws_ok(
  $$ select public.report_signalisation_gone('11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'already_voted', 'un second vote du même compte est refusé'
);
select is(
  (select array_agg(signalisation_id) from public.my_gone_votes()),
  array['11111111-1111-1111-1111-111111111111'::uuid], 'le compte retrouve son vote'
);
select throws_ok(
  $$ select * from public.signalisation_gone_votes $$,
  '42501', null, 'la table des votes n’est pas lisible directement'
);

-- Un autre compte
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b","is_anonymous":false}', true);
select is((select count(*) from public.my_gone_votes())::int, 0, 'un compte ne voit pas les votes des autres');

-- « Toujours là » remet les votes à zéro : Julie peut revoter
select is(
  (select gone_votes from public.confirm_signalisation('11111111-1111-1111-1111-111111111111')),
  0, '« Toujours là » remet le compteur à zéro'
);
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}', true);
select is(
  (select gone_votes from public.report_signalisation_gone('11111111-1111-1111-1111-111111111111')),
  1, 'après « Toujours là », le même compte peut revoter'
);

select * from finish();
rollback;
