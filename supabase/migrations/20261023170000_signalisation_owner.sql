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

-- « Plus là » de l'auteur·rice (résolu tout de suite) : voir report_signalisation_gone dans 20261023180000_hide_author.sql

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
revoke execute on function public.delete_signalisation(uuid) from public, anon;
grant execute on function public.my_signalisations() to authenticated;
grant execute on function public.delete_signalisation(uuid) to authenticated;

-- Photos : chaque compte peut effacer celles qu'il a déposées (owner_id, rempli par Supabase Storage à l'envoi).
-- Supabase Storage demande les droits select et delete pour supprimer un fichier.
drop policy if exists "signalisation_photos_select_own" on storage.objects;
create policy "signalisation_photos_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'signalisation-photos'
  and public.is_registered()
  and owner_id = (select auth.uid())::text
);

drop policy if exists "signalisation_photos_delete_own" on storage.objects;
create policy "signalisation_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'signalisation-photos'
  and public.is_registered()
  and owner_id = (select auth.uid())::text
);

notify pgrst, 'reload schema';
