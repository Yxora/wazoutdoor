-- Commentaires sur les signalements, et alignement des fonctions du cycle de vie.
-- Rattrape la base où 20261011150000 a été appliquée avant l'ajout des commentaires. Peut être rejouée sans risque.

alter table public.signalisations
  add column if not exists gone_votes integer not null default 0 check (gone_votes >= 0),
  add column if not exists comments text[] not null default '{}';

-- Les modifications passent désormais par les fonctions ci-dessous (security definer) : plus de droit d'écriture ouvert.
drop policy if exists "signalisations_update_public" on public.signalisations;
revoke update (description, photo_url, created_at, lat, lng, gone_votes, comments)
  on public.signalisations from anon, authenticated;

create or replace function public.report_signalisation_gone(p_id uuid)
returns setof public.signalisations
language sql
security definer
set search_path = public
as $$
  update public.signalisations
  set gone_votes = gone_votes + 1
  where id = p_id
  returning *;
$$;

create or replace function public.confirm_signalisation(p_id uuid)
returns setof public.signalisations
language sql
security definer
set search_path = public
as $$
  update public.signalisations
  set created_at = now(), gone_votes = 0
  where id = p_id
  returning *;
$$;

-- 140 caractères et 10 commentaires au plus
create or replace function public.add_signalisation_comment(p_id uuid, p_comment text)
returns setof public.signalisations
language sql
security definer
set search_path = public
as $$
  update public.signalisations
  set comments = array_append(comments, left(btrim(p_comment), 140))
  where id = p_id
    and btrim(p_comment) <> ''
    and cardinality(comments) < 10
  returning *;
$$;

revoke execute on function public.report_signalisation_gone(uuid) from public;
revoke execute on function public.confirm_signalisation(uuid) from public;
revoke execute on function public.add_signalisation_comment(uuid, text) from public;
grant execute on function public.report_signalisation_gone(uuid) to anon, authenticated;
grant execute on function public.confirm_signalisation(uuid) to anon, authenticated;
grant execute on function public.add_signalisation_comment(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
