begin;

create table public.tier_lists (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 80
  ),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tier_lists_user_name_unique
  on public.tier_lists (user_id, lower(name));
create index tier_lists_user_created_at_idx
  on public.tier_lists (user_id, created_at desc);

create table public.tier_list_items (
  tier_list_id bigint not null references public.tier_lists(id) on delete cascade,
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
  release_date date,
  tier text check (tier is null or tier in ('S', 'A', 'B', 'C', 'D')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (tier_list_id, igdb_id)
);

create index tier_list_items_order_idx
  on public.tier_list_items (tier_list_id, tier, position, created_at);

alter table public.tier_lists enable row level security;
alter table public.tier_list_items enable row level security;

create policy tier_lists_select_own
on public.tier_lists
for select
to authenticated
using (user_id = (select auth.uid()));

create policy tier_lists_insert_own
on public.tier_lists
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy tier_lists_update_own
on public.tier_lists
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy tier_lists_delete_own
on public.tier_lists
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy tier_list_items_select_own
on public.tier_list_items
for select
to authenticated
using (
  exists (
    select 1
    from public.tier_lists as owner_list
    where owner_list.id = tier_list_id
      and owner_list.user_id = (select auth.uid())
  )
);

create policy tier_list_items_insert_own
on public.tier_list_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tier_lists as owner_list
    where owner_list.id = tier_list_id
      and owner_list.user_id = (select auth.uid())
  )
);

create policy tier_list_items_update_own
on public.tier_list_items
for update
to authenticated
using (
  exists (
    select 1
    from public.tier_lists as owner_list
    where owner_list.id = tier_list_id
      and owner_list.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.tier_lists as owner_list
    where owner_list.id = tier_list_id
      and owner_list.user_id = (select auth.uid())
  )
);

create policy tier_list_items_delete_own
on public.tier_list_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.tier_lists as owner_list
    where owner_list.id = tier_list_id
      and owner_list.user_id = (select auth.uid())
  )
);

revoke all on table public.tier_lists from public, anon;
revoke all on table public.tier_list_items from public, anon;
revoke all on sequence public.tier_lists_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.tier_lists to authenticated;
grant select, insert, update, delete on table public.tier_list_items to authenticated;
grant usage on sequence public.tier_lists_id_seq to authenticated;

commit;
