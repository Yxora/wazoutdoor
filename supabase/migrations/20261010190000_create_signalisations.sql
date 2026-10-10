-- Signalements communautaires de dangers sur les itinéraires outdoor (rando, trail, VTT).
-- Table publique, sans authentification : app encore au stade prototype (voir CLAUDE.md).

create table if not exists public.signalisations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'eboulis', 'arbre', 'boue', 'neige', 'eau', 'incendie', 'chasse', 'troupeau', 'balisage', 'brouillard', 'dechets', 'autre'
  )),
  description text not null default '' check (char_length(description) <= 280),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

comment on table public.signalisations is 'Signalements communautaires de dangers, remontés depuis la webapp (sans compte utilisateur).';

create index if not exists signalisations_created_at_idx on public.signalisations (created_at desc);

alter table public.signalisations enable row level security;

-- Lecture publique : la carte doit afficher les signalements à tout le monde, sans compte.
create policy "signalisations_select_public"
on public.signalisations
for select
to anon, authenticated
using (true);

-- Écriture publique : signalement anonyme (pas d'auth dans ce prototype).
-- Pas de policy update/delete : un signalement est immuable une fois créé.
create policy "signalisations_insert_public"
on public.signalisations
for insert
to anon, authenticated
with check (true);
