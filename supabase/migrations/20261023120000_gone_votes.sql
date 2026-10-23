-- Un vote « Plus là » par compte. Avant, le seul garde-fou était le localStorage du navigateur.
-- Peut être rejouée sans risque.

create table if not exists public.signalisation_gone_votes (
  signalisation_id uuid not null references public.signalisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (signalisation_id, user_id)
);

comment on table public.signalisation_gone_votes is 'Votes « Plus là » : un par compte et par signalement. Accès par les fonctions security definer seulement.';

-- La clé primaire couvre signalisation_id ; cet index sert my_gone_votes() et la suppression d'un compte
create index if not exists signalisation_gone_votes_user_id_idx on public.signalisation_gone_votes (user_id);

-- Pas de policy : la table n'est lue et écrite que par les fonctions ci-dessous
alter table public.signalisation_gone_votes enable row level security;
revoke all on table public.signalisation_gone_votes from anon, authenticated;

-- gone_votes (sur signalisations) reste le compteur affiché. Il n'augmente que si le vote est nouveau ;
-- un second vote du même compte lève already_voted (PostgREST répond 400).
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

-- « Toujours là » remet les votes à zéro : chacun·e peut revoter « Plus là » ensuite
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
  delete from public.signalisation_gone_votes where signalisation_id = p_id;
  return query
    update public.signalisations
    set created_at = now(), gone_votes = 0
    where id = p_id
    returning *;
end;
$$;

-- Signalements où le compte a voté « Plus là » : le bouton est grisé dès l'ouverture de l'app
create or replace function public.my_gone_votes()
returns table (signalisation_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select v.signalisation_id
  from public.signalisation_gone_votes v
  where public.is_registered()
    and v.user_id = (select auth.uid());
$$;

revoke execute on function public.report_signalisation_gone(uuid) from public, anon;
revoke execute on function public.confirm_signalisation(uuid) from public, anon;
revoke execute on function public.my_gone_votes() from public, anon;
grant execute on function public.report_signalisation_gone(uuid) to authenticated;
grant execute on function public.confirm_signalisation(uuid) to authenticated;
grant execute on function public.my_gone_votes() to authenticated;

notify pgrst, 'reload schema';
