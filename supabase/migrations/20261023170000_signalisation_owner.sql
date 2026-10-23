-- L'auteur·rice d'un signalement peut, à tout moment, le supprimer (erreur de signalement)
-- ou dire « Plus là » (le danger a disparu : résolu tout de suite).
-- Peut être rejouée sans risque.

-- Résolu par son auteur·rice (« Plus là ») : il quitte la carte et le score mais reste en base
alter table public.signalisations
  add column if not exists resolved_at timestamptz;

-- Signalements du compte : la bulle affiche la poubelle seulement sur les siens
create or replace function public.my_signalisations()
returns table (signalisation_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.signalisations s
  where public.is_registered()
    and s.user_id = (select auth.uid());
$$;

-- Ancienne version de cette migration, jamais appliquée en production : retirée
drop function if exists public.resolve_signalisation(uuid);

-- « Plus là » : l'auteur·rice sait que le danger a disparu, son signalement est résolu tout de suite.
-- Pour les autres, rien ne change : un vote par compte, résolu à deux votes (20261023120000_gone_votes.sql).
create or replace function public.report_signalisation_gone(p_id uuid)
returns setof public.signalisations
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_registered() then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  -- Signalement inconnu : aucune ligne, comme avant (le front affiche « introuvable »)
  if not exists (select 1 from public.signalisations where id = p_id) then
    return;
  end if;
  if exists (select 1 from public.signalisations where id = p_id and user_id = (select auth.uid())) then
    return query
      update public.signalisations
      set resolved_at = coalesce(resolved_at, now())
      where id = p_id
      returning *;
    return;
  end if;
  insert into public.signalisation_gone_votes (signalisation_id, user_id)
  values (p_id, (select auth.uid()))
  on conflict do nothing;
  if not found then
    raise exception 'already_voted' using errcode = 'P0001';
  end if;
  return query
    update public.signalisations
    set gone_votes = gone_votes + 1
    where id = p_id
    returning *;
end;
$$;

-- Erreur not_owner si le signalement n'est pas le sien (PostgREST répond 400).
-- Les votes « plus là » partent avec le signalement (on delete cascade). La photo est effacée par le front,
-- avant cet appel, avec la policy de suppression ci-dessous.
create or replace function public.delete_signalisation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_registered() then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  delete from public.signalisations
  where id = p_id
    and user_id = (select auth.uid());
  if not found then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.my_signalisations() from public, anon;
revoke execute on function public.report_signalisation_gone(uuid) from public, anon;
revoke execute on function public.delete_signalisation(uuid) from public, anon;
grant execute on function public.my_signalisations() to authenticated;
grant execute on function public.report_signalisation_gone(uuid) to authenticated;
grant execute on function public.delete_signalisation(uuid) to authenticated;

-- Photos : chaque compte peut effacer celles de son dossier <user_id>/.
-- Supabase Storage demande les droits select et delete pour supprimer un fichier.
drop policy if exists "signalisation_photos_select_own" on storage.objects;
create policy "signalisation_photos_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'signalisation-photos'
  and public.is_registered()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "signalisation_photos_delete_own" on storage.objects;
create policy "signalisation_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'signalisation-photos'
  and public.is_registered()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

notify pgrst, 'reload schema';
