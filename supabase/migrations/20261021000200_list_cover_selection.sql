begin;

create table public.list_cover_items (
  list_id bigint not null,
  game_id bigint not null,
  position smallint not null check (position between 1 and 3),
  primary key (list_id, game_id),
  unique (list_id, position),
  foreign key (list_id, game_id)
    references public.list_items (list_id, game_id)
    on delete cascade
);

alter table public.list_cover_items enable row level security;
revoke all on table public.list_cover_items from public, anon, authenticated;

create function public.get_list_cover_game_ids(p_list_id bigint)
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

  if p_list_id is null or p_list_id not between 1 and 9007199254740991 then
    raise exception 'List id must be a positive safe integer' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.lists as user_list
    where user_list.id = p_list_id
      and user_list.user_id = v_user_id
  ) then
    raise exception 'List is unavailable' using errcode = '42501';
  end if;

  return query
  select stored_game.igdb_id
  from public.list_cover_items as cover_item
  join public.games as stored_game
    on stored_game.id = cover_item.game_id
    and stored_game.user_id = v_user_id
  where cover_item.list_id = p_list_id
  order by cover_item.position;
end;
$$;

create function public.set_list_cover_game_ids(p_list_id bigint, p_igdb_ids bigint[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_count integer := cardinality(coalesce(p_igdb_ids, array[]::bigint[]));
  v_matching_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_list_id is null or p_list_id not between 1 and 9007199254740991 then
    raise exception 'List id must be a positive safe integer' using errcode = '22023';
  end if;

  if v_requested_count > 3
    or exists (
      select 1
      from unnest(coalesce(p_igdb_ids, array[]::bigint[])) as requested_game(igdb_id)
      where requested_game.igdb_id is null
        or requested_game.igdb_id not between 1 and 9007199254740991
    )
    or v_requested_count <> (
      select count(distinct requested_game.igdb_id)::integer
      from unnest(coalesce(p_igdb_ids, array[]::bigint[])) as requested_game(igdb_id)
    )
  then
    raise exception 'At most three unique positive safe game ids are allowed'
      using errcode = '22023';
  end if;

  perform 1
  from public.lists as user_list
  where user_list.id = p_list_id
    and user_list.user_id = v_user_id
  for update;

  if not found then
    raise exception 'List is unavailable' using errcode = '42501';
  end if;

  select count(*)::integer
  into v_matching_count
  from unnest(coalesce(p_igdb_ids, array[]::bigint[])) as requested_game(igdb_id)
  join public.games as stored_game
    on stored_game.igdb_id = requested_game.igdb_id
    and stored_game.user_id = v_user_id
    and stored_game.cover_url is not null
  join public.list_items as list_item
    on list_item.game_id = stored_game.id
    and list_item.list_id = p_list_id;

  if v_matching_count <> v_requested_count then
    raise exception 'Every selected cover must belong to the list and have an image'
      using errcode = '22023';
  end if;

  delete from public.list_cover_items as cover_item
  where cover_item.list_id = p_list_id;

  insert into public.list_cover_items (list_id, game_id, position)
  select p_list_id, stored_game.id, requested_game.ordinality::smallint
  from unnest(coalesce(p_igdb_ids, array[]::bigint[])) with ordinality
    as requested_game(igdb_id, ordinality)
  join public.games as stored_game
    on stored_game.igdb_id = requested_game.igdb_id
    and stored_game.user_id = v_user_id;

  return true;
end;
$$;

create or replace function public.get_my_lists()
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
    coalesce(manual_covers.covers, latest_covers.covers, array[]::text[])
  from public.lists as user_list
  cross join lateral (
    select count(*)::bigint as game_count
    from public.list_items as counted_item
    where counted_item.list_id = user_list.id
  ) as item_count
  cross join lateral (
    select array_agg(selected_game.cover_url order by cover_item.position) as covers
    from public.list_cover_items as cover_item
    join public.games as selected_game
      on selected_game.id = cover_item.game_id
      and selected_game.user_id = v_user_id
    where cover_item.list_id = user_list.id
  ) as manual_covers
  cross join lateral (
    select array_agg(recent_cover.cover_url order by recent_cover.added_at desc, recent_cover.game_id desc) as covers
    from (
      select
        covered_game.cover_url,
        covered_item.added_at,
        covered_item.game_id
      from public.list_items as covered_item
      join public.games as covered_game
        on covered_game.id = covered_item.game_id
        and covered_game.user_id = v_user_id
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

revoke all on function public.get_list_cover_game_ids(bigint) from public, anon, authenticated;
revoke all on function public.set_list_cover_game_ids(bigint, bigint[]) from public, anon, authenticated;
grant execute on function public.get_list_cover_game_ids(bigint) to authenticated;
grant execute on function public.set_list_cover_game_ids(bigint, bigint[]) to authenticated;

commit;
