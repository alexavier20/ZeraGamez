begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id bigint generated always as identity primary key,
  igdb_id bigint not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  cover_url text,
  release_date date,
  created_at timestamptz not null default now()
);

create table public.lists (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  system_key text check (system_key is null or system_key = 'want_to_play'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_items (
  list_id bigint not null references public.lists(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, game_id)
);

create index lists_user_id_created_at_idx on public.lists (user_id, created_at desc);
create unique index lists_user_system_key_idx on public.lists (user_id, system_key)
  where system_key is not null;
create index list_items_game_id_idx on public.list_items (game_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '')
    ),
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'picture'), '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name, avatar_url)
select
  users.id,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(split_part(coalesce(users.email, ''), '@', 1)), '')
  ),
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'picture'), '')
  )
from auth.users as users
where not exists (
  select 1
  from public.profiles as profiles
  where profiles.id = users.id
)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy games_select_authenticated
on public.games
for select
to authenticated
using (true);

create policy lists_select_own
on public.lists
for select
to authenticated
using (user_id = (select auth.uid()));

create policy lists_insert_custom_own
on public.lists
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and system_key is null
);

create policy list_items_select_own
on public.list_items
for select
to authenticated
using (
  exists (
    select 1
    from public.lists as owner_list
    where owner_list.id = list_id
      and owner_list.user_id = (select auth.uid())
  )
);

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.games from public, anon, authenticated;
revoke all on table public.lists from public, anon, authenticated;
revoke all on table public.list_items from public, anon, authenticated;
revoke all on sequence public.games_id_seq from public, anon, authenticated;
revoke all on sequence public.lists_id_seq from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;
grant select on table public.games to authenticated;
grant select on table public.lists to authenticated;
grant insert (user_id, name, description, system_key) on table public.lists to authenticated;
grant usage on sequence public.lists_id_seq to authenticated;
grant select on table public.list_items to authenticated;

create function public.get_my_lists()
returns table (
  id bigint,
  name text,
  description text,
  system_key text,
  game_count bigint,
  covers text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select
    user_list.id,
    user_list.name,
    user_list.description,
    user_list.system_key,
    item_count.game_count,
    coalesce(latest_covers.covers, array[]::text[])
  from public.lists as user_list
  cross join lateral (
    select count(*)::bigint as game_count
    from public.list_items as counted_item
    where counted_item.list_id = user_list.id
  ) as item_count
  cross join lateral (
    select array_agg(recent_cover.cover_url order by recent_cover.added_at desc, recent_cover.game_id desc) as covers
    from (
      select
        covered_game.cover_url,
        covered_item.added_at,
        covered_item.game_id
      from public.list_items as covered_item
      join public.games as covered_game on covered_game.id = covered_item.game_id
      where covered_item.list_id = user_list.id
        and covered_game.cover_url is not null
      order by covered_item.added_at desc, covered_item.game_id desc
      limit 3
    ) as recent_cover
  ) as latest_covers
  where user_list.user_id = v_user_id
  order by user_list.created_at desc, user_list.id desc;
end;
$$;

create function public.get_want_to_play_igdb_ids(p_igdb_ids bigint[])
returns table (igdb_id bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select distinct stored_game.igdb_id
  from unnest(coalesce(p_igdb_ids, array[]::bigint[])) as requested_game(igdb_id)
  join public.games as stored_game on stored_game.igdb_id = requested_game.igdb_id
  join public.list_items as wanted_item on wanted_item.game_id = stored_game.id
  join public.lists as wanted_list on wanted_list.id = wanted_item.list_id
  where wanted_list.user_id = v_user_id
    and wanted_list.system_key = 'want_to_play';
end;
$$;

create function public.add_game_to_lists(
  p_igdb_id bigint,
  p_name text,
  p_cover_url text,
  p_release_date date,
  p_list_ids bigint[]
)
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_ids bigint[];
  v_game_id bigint;
  v_associated_list_ids bigint[];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(
    array_agg(distinct requested_list.list_id order by requested_list.list_id),
    array[]::bigint[]
  )
  into v_list_ids
  from unnest(coalesce(p_list_ids, array[]::bigint[])) as requested_list(list_id)
  where requested_list.list_id is not null;

  if cardinality(v_list_ids) = 0 then
    raise exception 'At least one list is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_list_ids) as requested_list(list_id)
    left join public.lists as owned_list
      on owned_list.id = requested_list.list_id
      and owned_list.user_id = v_user_id
    where owned_list.id is null
  ) then
    raise exception 'One or more lists are unavailable' using errcode = '42501';
  end if;

  insert into public.games (igdb_id, name, cover_url, release_date)
  values (p_igdb_id, p_name, p_cover_url, p_release_date)
  on conflict (igdb_id) do nothing;

  select stored_game.id
  into strict v_game_id
  from public.games as stored_game
  where stored_game.igdb_id = p_igdb_id;

  insert into public.list_items (list_id, game_id)
  select requested_list.list_id, v_game_id
  from unnest(v_list_ids) as requested_list(list_id)
  on conflict (list_id, game_id) do nothing;

  select coalesce(
    array_agg(associated_item.list_id order by associated_item.list_id),
    array[]::bigint[]
  )
  into v_associated_list_ids
  from public.list_items as associated_item
  where associated_item.game_id = v_game_id
    and associated_item.list_id = any(v_list_ids);

  return v_associated_list_ids;
end;
$$;

create function public.toggle_want_to_play(
  p_igdb_id bigint,
  p_name text,
  p_cover_url text,
  p_release_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_id bigint;
  v_game_id bigint;
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.lists as created_list (user_id, name, system_key)
  values (v_user_id, 'Quero jogar!', 'want_to_play')
  on conflict (user_id, system_key) where system_key is not null do nothing
  returning created_list.id into v_list_id;

  if v_list_id is null then
    select existing_list.id
    into strict v_list_id
    from public.lists as existing_list
    where existing_list.user_id = v_user_id
      and existing_list.system_key = 'want_to_play';
  end if;

  perform 1
  from public.lists as locked_list
  where locked_list.id = v_list_id
  for update;

  insert into public.games (igdb_id, name, cover_url, release_date)
  values (p_igdb_id, p_name, p_cover_url, p_release_date)
  on conflict (igdb_id) do nothing;

  select stored_game.id
  into strict v_game_id
  from public.games as stored_game
  where stored_game.igdb_id = p_igdb_id;

  delete from public.list_items as wanted_item
  where wanted_item.list_id = v_list_id
    and wanted_item.game_id = v_game_id;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    return false;
  end if;

  insert into public.list_items (list_id, game_id)
  values (v_list_id, v_game_id)
  on conflict (list_id, game_id) do nothing;

  return exists (
    select 1
    from public.list_items as final_item
    where final_item.list_id = v_list_id
      and final_item.game_id = v_game_id
  );
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.get_my_lists() from public, anon, authenticated;
revoke all on function public.get_want_to_play_igdb_ids(bigint[]) from public, anon, authenticated;
revoke all on function public.add_game_to_lists(bigint, text, text, date, bigint[]) from public, anon, authenticated;
revoke all on function public.toggle_want_to_play(bigint, text, text, date) from public, anon, authenticated;

grant execute on function public.handle_new_user() to authenticated;
grant execute on function public.get_my_lists() to authenticated;
grant execute on function public.get_want_to_play_igdb_ids(bigint[]) to authenticated;
grant execute on function public.add_game_to_lists(bigint, text, text, date, bigint[]) to authenticated;
grant execute on function public.toggle_want_to_play(bigint, text, text, date) to authenticated;

commit;
