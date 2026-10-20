begin;

alter table public.list_items
  add column position integer not null default 0;

with ordered_items as (
  select
    list_item.list_id,
    list_item.game_id,
    (row_number() over (
      partition by list_item.list_id
      order by list_item.added_at desc, list_item.game_id desc
    ) - 1)::integer as position
  from public.list_items as list_item
)
update public.list_items as list_item
set position = ordered_items.position
from ordered_items
where ordered_items.list_id = list_item.list_id
  and ordered_items.game_id = list_item.game_id;

create index list_items_list_id_position_idx
  on public.list_items (list_id, position);

create function public.append_list_item_position()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_next_position integer;
begin
  perform 1
  from public.lists as user_list
  where user_list.id = new.list_id
  for update;

  select coalesce(max(list_item.position) + 1, 0)
  into v_next_position
  from public.list_items as list_item
  where list_item.list_id = new.list_id;

  new.position := v_next_position;
  return new;
end;
$$;

revoke all on function public.append_list_item_position() from public, anon, authenticated;

create trigger list_items_append_position
before insert on public.list_items
for each row execute function public.append_list_item_position();

create or replace function public.get_list_games(p_list_id bigint)
returns table (
  igdb_id bigint,
  name text,
  cover_url text,
  release_date date
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

  if p_list_id is null or p_list_id not between 1 and 9007199254740991 then
    raise exception 'List id must be a positive safe integer' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.lists as owner_list
    where owner_list.id = p_list_id
      and owner_list.user_id = v_user_id
  ) then
    raise exception 'List is unavailable' using errcode = '42501';
  end if;

  return query
  select stored_game.igdb_id, stored_game.name, stored_game.cover_url, stored_game.release_date
  from public.list_items as list_item
  join public.games as stored_game
    on stored_game.id = list_item.game_id
    and stored_game.user_id = v_user_id
  where list_item.list_id = p_list_id
  order by list_item.position, list_item.added_at desc, stored_game.id desc;
end;
$$;

create function public.move_list_game(
  p_list_id bigint,
  p_igdb_id bigint,
  p_position integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game_id bigint;
  v_target_game_id bigint;
  v_current_position integer;
  v_game_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_list_id is null or p_list_id not between 1 and 9007199254740991 then
    raise exception 'List id must be a positive safe integer' using errcode = '22023';
  end if;

  if p_igdb_id is null or p_igdb_id not between 1 and 9007199254740991 then
    raise exception 'Game id must be a positive safe integer' using errcode = '22023';
  end if;

  if p_position is null or p_position < 0 then
    raise exception 'Position must be a nonnegative integer' using errcode = '22023';
  end if;

  perform 1
  from public.lists as owner_list
  where owner_list.id = p_list_id
    and owner_list.user_id = v_user_id
  for update;

  if not found then
    raise exception 'List is unavailable' using errcode = '42501';
  end if;

  with ordered_items as (
    select
      list_item.list_id,
      list_item.game_id,
      (row_number() over (
        order by list_item.position, list_item.added_at desc, list_item.game_id desc
      ) - 1)::integer as position
    from public.list_items as list_item
    join public.games as stored_game
      on stored_game.id = list_item.game_id
      and stored_game.user_id = v_user_id
    where list_item.list_id = p_list_id
  )
  update public.list_items as list_item
  set position = ordered_items.position
  from ordered_items
  where list_item.list_id = ordered_items.list_id
    and list_item.game_id = ordered_items.game_id;

  select count(*)::integer
  into v_game_count
  from public.list_items as list_item
  join public.games as stored_game
    on stored_game.id = list_item.game_id
    and stored_game.user_id = v_user_id
  where list_item.list_id = p_list_id;

  select list_item.game_id, list_item.position
  into v_game_id, v_current_position
  from public.list_items as list_item
  join public.games as stored_game
    on stored_game.id = list_item.game_id
    and stored_game.user_id = v_user_id
  where list_item.list_id = p_list_id
    and stored_game.igdb_id = p_igdb_id;

  if not found then
    raise exception 'Game is unavailable in this list' using errcode = '42501';
  end if;

  if p_position >= v_game_count then
    raise exception 'Position is outside this list' using errcode = '22023';
  end if;

  select list_item.game_id
  into v_target_game_id
  from public.list_items as list_item
  join public.games as stored_game
    on stored_game.id = list_item.game_id
    and stored_game.user_id = v_user_id
  where list_item.list_id = p_list_id
    and list_item.position = p_position;

  if v_target_game_id is null then
    raise exception 'Position is outside this list' using errcode = '22023';
  end if;

  if v_current_position = p_position then
    return true;
  end if;

  update public.list_items as list_item
  set position = case
    when list_item.game_id = v_game_id then p_position
    when list_item.game_id = v_target_game_id then v_current_position
  end
  where list_item.list_id = p_list_id
    and list_item.game_id in (v_game_id, v_target_game_id);

  return true;
end;
$$;

create or replace function public.remove_game_from_list(p_list_id bigint, p_igdb_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game_id bigint;
  v_position integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_list_id is null or p_list_id not between 1 and 9007199254740991 then
    raise exception 'List id must be a positive safe integer' using errcode = '22023';
  end if;

  if p_igdb_id is null or p_igdb_id not between 1 and 9007199254740991 then
    raise exception 'Game id must be a positive safe integer' using errcode = '22023';
  end if;

  perform 1
  from public.lists as owner_list
  where owner_list.id = p_list_id
    and owner_list.user_id = v_user_id
  for update;

  if not found then
    raise exception 'List is unavailable' using errcode = '42501';
  end if;

  select list_item.game_id, list_item.position
  into v_game_id, v_position
  from public.list_items as list_item
  join public.games as stored_game
    on stored_game.id = list_item.game_id
    and stored_game.user_id = v_user_id
  where list_item.list_id = p_list_id
    and stored_game.igdb_id = p_igdb_id;

  if not found then
    return false;
  end if;

  delete from public.list_items as list_item
  where list_item.list_id = p_list_id
    and list_item.game_id = v_game_id;

  update public.list_items as remaining_item
  set position = remaining_item.position - 1
  where remaining_item.list_id = p_list_id
    and remaining_item.position > v_position;

  return true;
end;
$$;

revoke all on function public.get_list_games(bigint) from public, anon, authenticated;
revoke all on function public.move_list_game(bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.remove_game_from_list(bigint, bigint) from public, anon, authenticated;

grant execute on function public.get_list_games(bigint) to authenticated;
grant execute on function public.move_list_game(bigint, bigint, integer) to authenticated;
grant execute on function public.remove_game_from_list(bigint, bigint) to authenticated;

commit;
