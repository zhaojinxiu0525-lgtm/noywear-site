-- NoY garden wall — run once in the Supabase SQL editor.
-- The site may insert a piece and read published rows. It cannot update or delete.
-- Hide a piece from the wall by setting published = false in the table editor
-- (the dashboard uses a role that bypasses these policies).

create table if not exists public.garden_pieces (
  id uuid primary key,
  created_at timestamptz not null default now(),
  display_name text,
  title text,
  image_path text not null,
  published boolean not null default true,
  constraint garden_pieces_name_len check (display_name is null or char_length(display_name) <= 40),
  constraint garden_pieces_title_len check (title is null or char_length(title) <= 60),
  constraint garden_pieces_path_len check (char_length(image_path) between 5 and 80)
);

alter table public.garden_pieces enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on table public.garden_pieces to anon, authenticated;

drop policy if exists "garden pieces are readable when published" on public.garden_pieces;
create policy "garden pieces are readable when published"
  on public.garden_pieces
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists "garden pieces can be hung once" on public.garden_pieces;
create policy "garden pieces can be hung once"
  on public.garden_pieces
  for insert
  to anon, authenticated
  with check (
    published = true
    and image_path = id::text || '.jpg'
    and (display_name is null or char_length(display_name) <= 40)
    and (title is null or char_length(title) <= 60)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('garden-pieces', 'garden-pieces', true, 524288, array['image/jpeg']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "garden images are public" on storage.objects;
create policy "garden images are public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'garden-pieces');

drop policy if exists "garden images can be uploaded" on storage.objects;
create policy "garden images can be uploaded"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'garden-pieces'
    and (storage.foldername(name))[1] is null
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );
