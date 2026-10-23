-- Retrait d'un signalement par son auteur·rice (migration 20261023170000_signalisation_owner.sql).
-- Lancer avec `supabase test db` sur une base locale (`supabase start`), jamais sur la base de production.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'julie@exemple.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'marc@exemple.fr');
insert into public.signalisations (id, type, lat, lng, user_id) values
  ('11111111-1111-1111-1111-111111111111', 'arbre', 48.05, 7.02, '00000000-0000-0000-0000-00000000000a'),
  ('22222222-2222-2222-2222-222222222222', 'boue', 48.06, 7.03, '00000000-0000-0000-0000-00000000000a');

-- Marc n'est pas l'auteur
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b","is_anonymous":false}', true);
select is(
  (select gone_votes from public.report_signalisation_gone('11111111-1111-1111-1111-111111111111')),
  1, '« Plus là » d’un autre compte : un vote'
);
select is(
  (select resolved_at from public.signalisations where id = '11111111-1111-1111-1111-111111111111'),
  null, 'le vote d’un autre compte ne résout pas'
);
select throws_ok(
  $$ select public.delete_signalisation('11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'not_owner', 'un autre compte ne peut pas supprimer'
);
select is((select count(*) from public.my_signalisations())::int, 0, 'Marc n’a aucun signalement');

-- Julie, l'autrice
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}', true);
select is((select count(*) from public.my_signalisations())::int, 2, 'Julie retrouve ses signalements');
select isnt(
  (select resolved_at from public.report_signalisation_gone('11111111-1111-1111-1111-111111111111')),
  null, '« Plus là » de l’autrice : résolu tout de suite'
);
select is(
  (select gone_votes from public.signalisations where id = '11111111-1111-1111-1111-111111111111'),
  1, 'le « Plus là » de l’autrice n’ajoute pas de vote'
);
select lives_ok(
  $$ select public.delete_signalisation('22222222-2222-2222-2222-222222222222') $$,
  'l’autrice supprime son signalement'
);
select is(
  (select count(*) from public.signalisations where id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'le signalement supprimé n’est plus en base'
);

select * from finish();
rollback;
