-- L'auteur·rice d'un signalement n'est plus visible. Avant, user_id était lisible par tout le monde
-- (lecture publique de toutes les colonnes, fonctions qui renvoient la ligne entière, dossier <user_id>/
-- dans l'adresse des photos) : on pouvait regrouper les signalements d'une même personne, donc ses sorties.
-- Peut être rejouée sans risque.

-- 1. Lecture colonne par colonne : tout sauf user_id
revoke select on table public.signalisations from anon, authenticated;
grant select (id, type, description, lat, lng, created_at, photo_url, gone_votes, comments, resolved_at)
  on table public.signalisations to anon, authenticated;

-- 2. Les fonctions renvoient les mêmes colonnes, sans user_id. Le type de retour change : il faut les recréer.
drop function if exists public.report_signalisation_gone(uuid);
drop function if exists public.confirm_signalisation(uuid);
drop function if exists public.add_signalisation_comment(uuid, text);

-- « Plus là » : un vote par compte, résolu à deux votes (already_voted au second vote du même compte).
-- Venu de l'auteur·rice, qui sait que le danger a disparu : résolu tout de suite, sans vote.
create function public.report_signalisation_gone(p_id uuid)
returns table (
  id uuid, type text, description text, lat double precision, lng double precision, created_at timestamptz,
  photo_url text, gone_votes integer, comments text[], resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_registered() then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  -- Signalement inconnu : aucune ligne (le front affiche « introuvable »)
  if not exists (select 1 from public.signalisations s where s.id = p_id) then
    return;
  end if;
  if exists (select 1 from public.signalisations s where s.id = p_id and s.user_id = (select auth.uid())) then
    return query
      update public.signalisations s
      set resolved_at = coalesce(s.resolved_at, now())
      where s.id = p_id
      returning s.id, s.type, s.description, s.lat, s.lng, s.created_at, s.photo_url, s.gone_votes, s.comments, s.resolved_at;
    return;
  end if;
  insert into public.signalisation_gone_votes (signalisation_id, user_id)
  values (p_id, (select auth.uid()))
  on conflict do nothing;
  if not found then
    raise exception 'already_voted' using errcode = 'P0001';
  end if;
  return query
    update public.signalisations s
    set gone_votes = s.gone_votes + 1
    where s.id = p_id
    returning s.id, s.type, s.description, s.lat, s.lng, s.created_at, s.photo_url, s.gone_votes, s.comments, s.resolved_at;
end;
$$;

-- « Toujours là » : la date repart de maintenant, les votes sont remis à zéro
create function public.confirm_signalisation(p_id uuid)
returns table (
  id uuid, type text, description text, lat double precision, lng double precision, created_at timestamptz,
  photo_url text, gone_votes integer, comments text[], resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_registered() then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  delete from public.signalisation_gone_votes v where v.signalisation_id = p_id;
  return query
    update public.signalisations s
    set created_at = now(), gone_votes = 0
    where s.id = p_id
    returning s.id, s.type, s.description, s.lat, s.lng, s.created_at, s.photo_url, s.gone_votes, s.comments, s.resolved_at;
end;
$$;

-- 140 caractères et 10 commentaires au plus
create function public.add_signalisation_comment(p_id uuid, p_comment text)
returns table (
  id uuid, type text, description text, lat double precision, lng double precision, created_at timestamptz,
  photo_url text, gone_votes integer, comments text[], resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_registered() then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return query
    update public.signalisations s
    set comments = array_append(s.comments, left(btrim(p_comment), 140))
    where s.id = p_id
      and btrim(p_comment) <> ''
      and cardinality(s.comments) < 10
    returning s.id, s.type, s.description, s.lat, s.lng, s.created_at, s.photo_url, s.gone_votes, s.comments, s.resolved_at;
end;
$$;

revoke execute on function public.report_signalisation_gone(uuid) from public, anon;
revoke execute on function public.confirm_signalisation(uuid) from public, anon;
revoke execute on function public.add_signalisation_comment(uuid, text) from public, anon;
grant execute on function public.report_signalisation_gone(uuid) to authenticated;
grant execute on function public.confirm_signalisation(uuid) to authenticated;
grant execute on function public.add_signalisation_comment(uuid, text) to authenticated;

-- 3. Photos : plus de dossier <user_id>/ dans l'adresse. Le contrôle passe par owner_id,
--    que Supabase Storage remplit avec le compte qui envoie le fichier.
drop policy if exists "signalisation_photos_insert_registered" on storage.objects;
create policy "signalisation_photos_insert_registered"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'signalisation-photos'
  and public.is_registered()
  and owner_id = (select auth.uid())::text
);

notify pgrst, 'reload schema';
