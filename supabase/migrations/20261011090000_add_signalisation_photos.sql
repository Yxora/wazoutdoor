-- Photo jointe à un signalement pour le qualifier.

alter table public.signalisations
  add column if not exists photo_url text check (photo_url is null or char_length(photo_url) <= 500);

-- Bucket public en lecture (les photos s'affichent pour tout le monde), JPEG de 1 Mo maximum.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signalisation-photos', 'signalisation-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Dépôt anonyme, comme les signalements. Pas de policy update/delete : une photo est immuable.
create policy "signalisation_photos_insert_public"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'signalisation-photos');
