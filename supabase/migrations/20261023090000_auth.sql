-- Écritures réservées aux comptes (email). La lecture reste publique.
-- À appliquer le même jour que la publication du front qui envoie le jeton du compte :
-- sinon plus personne ne peut signaler. Peut être rejouée sans risque.

-- « Compte » = rôle authenticated et pas anonyme. La connexion anonyme est désactivée dans Supabase,
-- les policies le vérifient aussi au cas où elle serait activée par erreur.
create or replace function public.is_registered()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;

-- Auteur·rice du signalement. Les signalements existants gardent user_id = null,
-- et le gardent aussi à la suppression du compte.
alter table public.signalisations
  add column if not exists user_id uuid default auth.uid()
    references auth.users (id) on delete set null;

-- Index de la clé étrangère (suppression d'un compte) et des futurs quotas par compte
create index if not exists signalisations_user_id_idx on public.signalisations (user_id);

-- Insertion : un compte, et seulement en son nom. Le rôle anon n'a plus de policy d'insertion.
drop policy if exists "signalisations_insert_public" on public.signalisations;
drop policy if exists "signalisations_insert_registered" on public.signalisations;
create policy "signalisations_insert_registered"
on public.signalisations
for insert
to authenticated
with check (public.is_registered() and user_id = (select auth.uid()));

-- Photos : chaque compte dépose dans son dossier <user_id>/. Les photos déjà en ligne gardent leur adresse.
drop policy if exists "signalisation_photos_insert_public" on storage.objects;
drop policy if exists "signalisation_photos_insert_registered" on storage.objects;
create policy "signalisation_photos_insert_registered"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'signalisation-photos'
  and public.is_registered()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Les trois fonctions du cycle de vie refusent sans compte (42501 : PostgREST répond 403).
-- security definer : elles contournent la RLS, d'où le contrôle explicite du compte.
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
  return query
    update public.signalisations
    set gone_votes = gone_votes + 1
    where id = p_id
    returning *;
end;
$$;

create or replace function public.confirm_signalisation(p_id uuid)
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
    set created_at = now(), gone_votes = 0
    where id = p_id
    returning *;
end;
$$;

-- 140 caractères et 10 commentaires au plus
create or replace function public.add_signalisation_comment(p_id uuid, p_comment text)
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
    set comments = array_append(comments, left(btrim(p_comment), 140))
    where id = p_id
      and btrim(p_comment) <> ''
      and cardinality(comments) < 10
    returning *;
end;
$$;

revoke execute on function public.report_signalisation_gone(uuid) from public, anon;
revoke execute on function public.confirm_signalisation(uuid) from public, anon;
revoke execute on function public.add_signalisation_comment(uuid, text) from public, anon;
grant execute on function public.report_signalisation_gone(uuid) to authenticated;
grant execute on function public.confirm_signalisation(uuid) to authenticated;
grant execute on function public.add_signalisation_comment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
