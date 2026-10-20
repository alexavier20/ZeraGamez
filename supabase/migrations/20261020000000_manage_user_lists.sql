begin;

create function public.get_list_games(p_list_id bigint)
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
  order by list_item.added_at desc, stored_game.id desc;
end;
$$;

create function public.remove_game_from_list(p_list_id bigint, p_igdb_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game_id bigint;
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

  if not exists (
    select 1
    from public.lists as owner_list
    where owner_list.id = p_list_id
      and owner_list.user_id = v_user_id
  ) then
    raise exception 'List is unavailable' using errcode = '42501';
  end if;

  select stored_game.id
  into v_game_id
  from public.games as stored_game
  where stored_game.user_id = v_user_id
    and stored_game.igdb_id = p_igdb_id;

  if v_game_id is null then
    return false;
  end if;

  delete from public.list_items as list_item
  where list_item.list_id = p_list_id
    and list_item.game_id = v_game_id;

  return found;
end;
$$;

create function public.update_list(
  p_list_id bigint,
  p_name text,
  p_description text
)
returns boolean
language plpgsql
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

  if p_name is null
    or p_name <> btrim(p_name)
    or char_length(p_name) not between 1 and 80
  then
    raise exception 'List name must be canonical and between 1 and 80 characters'
      using errcode = '22023';
  end if;

  if p_description is not null and (
    p_description <> btrim(p_description)
    or char_length(p_description) > 500
  ) then
    raise exception 'List description must be canonical and at most 500 characters'
      using errcode = '22023';
  end if;

  update public.lists as user_list
  set name = p_name,
      description = p_description,
      updated_at = now()
  where user_list.id = p_list_id
    and user_list.user_id = v_user_id
    and user_list.system_key is null;

  if not found then
    raise exception 'Custom list is unavailable' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.get_list_games(bigint) from public, anon, authenticated;
revoke all on function public.remove_game_from_list(bigint, bigint) from public, anon, authenticated;
revoke all on function public.update_list(bigint, text, text) from public, anon, authenticated;

grant execute on function public.get_list_games(bigint) to authenticated;
grant execute on function public.remove_game_from_list(bigint, bigint) to authenticated;
grant execute on function public.update_list(bigint, text, text) to authenticated;

commit;
