begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'zera-profile-photos',
  'zera-profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users can view their own profile photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'zera-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their own profile photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'zera-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can replace their own profile photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'zera-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'zera-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
