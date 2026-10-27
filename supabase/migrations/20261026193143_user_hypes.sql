begin;

create table public.user_hypes (
  user_id uuid not null references auth.users(id) on delete cascade,
  igdb_id bigint not null check (igdb_id between 1 and 9007199254740991),
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 200
  ),
  cover_url text check (
    cover_url is null
    or (
      cover_url = btrim(cover_url)
      and char_length(cover_url) <= 2048
      and cover_url ~ '^https://images[.]igdb[.]com/igdb/image/upload/t_cover_big_2x/[A-Za-z0-9_-]+[.]jpg$'
    )
  ),
  release_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, igdb_id)
);

create index user_hypes_user_release_date_idx
  on public.user_hypes (user_id, release_date, created_at);

alter table public.user_hypes enable row level security;

create policy "Users can view their own hypes"
on public.user_hypes
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their own hypes"
on public.user_hypes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can remove their own hypes"
on public.user_hypes
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.user_hypes from public, anon;
grant select, insert, delete on table public.user_hypes to authenticated;

commit;
