-- L'auteur·rice d'un signalement peut, à tout moment, le marquer résolu ou le supprimer.
-- Peut être rejouée sans risque.

-- Résolu par son auteur·rice : il quitte la carte et le score mais reste en base
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

-- Erreurs : 42501 sans compte (PostgREST répond 403), not_owner si le signalement n'est pas le sien (400)
create or replace function public.resolve_signalisation(p_id uuid)
returns setof public.signalisations
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_registered() then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return query
    update public.signalisations
    set resolved_at = coalesce(resolved_at, now())
    where id = p_id
      and user_id = (select auth.uid())
    returning *;
  if not found then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;
end;
$$;

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
revoke execute on function public.resolve_signalisation(uuid) from public, anon;
revoke execute on function public.delete_signalisation(uuid) from public, anon;
grant execute on function public.my_signalisations() to authenticated;
grant execute on function public.resolve_signalisation(uuid) to authenticated;
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
