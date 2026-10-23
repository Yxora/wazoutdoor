-- Quotas par compte, pour limiter les abus. Valeurs = hypothèses, à ajuster après les premiers usages.
--   signalements : 20 par heure ; commentaires : 30 ; « Plus là » : 60 ; « Toujours là » : 60.
-- Au-delà : erreur rate_limited (PostgREST répond 400), le front affiche un message lisible.
-- Peut être rejouée sans risque.

-- Journal des écritures récentes de chaque compte. Seule check_quota() y touche (pas de policy).
-- On ne compte pas sur les tables elles-mêmes : « Toujours là » remet created_at à zéro,
-- et les commentaires ne disent pas qui les a écrits.
create table if not exists public.account_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('signalement', 'comment', 'gone_vote', 'confirm')),
  created_at timestamptz not null default now()
);

comment on table public.account_activity is 'Écritures de la dernière heure, par compte : sert aux quotas. Accès par check_quota() seulement.';

create index if not exists account_activity_user_kind_idx on public.account_activity (user_id, kind, created_at);

alter table public.account_activity enable row level security;
revoke all on table public.account_activity from anon, authenticated;

-- Compte l'écriture, ou la refuse si le quota de l'heure est atteint. Purge au passage les traces de plus d'une heure.
create or replace function public.check_quota(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_max integer := case p_kind
    when 'signalement' then 20
    when 'comment' then 30
    when 'gone_vote' then 60
    when 'confirm' then 60
  end;
begin
  if v_user is null or v_max is null then
    return;
  end if;
  delete from public.account_activity
  where user_id = v_user and created_at < now() - interval '1 hour';
  if (select count(*) from public.account_activity where user_id = v_user and kind = p_kind) >= v_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.account_activity (user_id, kind) values (v_user, p_kind);
end;
$$;

-- Appelée par le trigger et par les fonctions ci-dessous, pas par le front
revoke execute on function public.check_quota(text) from public, anon, authenticated;

-- Signalements : contrôle avant l'insertion
create or replace function public.signalisations_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_quota('signalement');
  return new;
end;
$$;

revoke execute on function public.signalisations_quota() from public, anon, authenticated;

drop trigger if exists signalisations_quota on public.signalisations;
create trigger signalisations_quota
before insert on public.signalisations
for each row execute function public.signalisations_quota();

-- Les trois fonctions du cycle de vie (versions de 20261023180000_hide_author.sql) avec leur quota.
-- Le type de retour ne change pas : create or replace suffit, les droits sont gardés.
create or replace function public.report_signalisation_gone(p_id uuid)
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
  if not exists (select 1 from public.signalisations s where s.id = p_id) then
    return;
  end if;
  perform public.check_quota('gone_vote');
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

create or replace function public.confirm_signalisation(p_id uuid)
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
  perform public.check_quota('confirm');
  delete from public.signalisation_gone_votes v where v.signalisation_id = p_id;
  return query
    update public.signalisations s
    set created_at = now(), gone_votes = 0
    where s.id = p_id
    returning s.id, s.type, s.description, s.lat, s.lng, s.created_at, s.photo_url, s.gone_votes, s.comments, s.resolved_at;
end;
$$;

create or replace function public.add_signalisation_comment(p_id uuid, p_comment text)
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
  perform public.check_quota('comment');
  return query
    update public.signalisations s
    set comments = array_append(s.comments, left(btrim(p_comment), 140))
    where s.id = p_id
      and btrim(p_comment) <> ''
      and cardinality(s.comments) < 10
    returning s.id, s.type, s.description, s.lat, s.lng, s.created_at, s.photo_url, s.gone_votes, s.comments, s.resolved_at;
end;
$$;

notify pgrst, 'reload schema';
