-- Préférences de chaque compte, pour les retrouver sur un autre appareil. Peut être rejouée sans risque.
-- Le contenu des colonnes jsonb est validé à la lecture par le front (valeur inconnue = valeur par défaut).

create table if not exists public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  activities text[] not null,
  preferences jsonb not null,
  signalisation_preferences jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is 'Préférences de score de chaque compte (activités, mode de chaque critère et de chaque type de signalement).';

alter table public.user_preferences enable row level security;

-- Données personnelles : aucun accès sans compte
revoke all on table public.user_preferences from anon;

-- Chaque compte ne lit et n'écrit que sa ligne. Pas de delete : la ligne part avec le compte (on delete cascade).
drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using (public.is_registered() and user_id = (select auth.uid()));

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check (public.is_registered() and user_id = (select auth.uid()));

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using (public.is_registered() and user_id = (select auth.uid()))
with check (public.is_registered() and user_id = (select auth.uid()));

notify pgrst, 'reload schema';
