begin;

update public.lists
set name = 'Quero Jogar!',
    updated_at = now()
where system_key = 'want_to_play'
  and name <> 'Quero Jogar!';

create or replace function public.set_want_to_play(
  p_igdb_id bigint,
  p_name text,
  p_cover_url text,
  p_release_date date,
  p_desired boolean
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
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_desired is null then
    raise exception 'Desired membership is required' using errcode = '22023';
  end if;

  if p_igdb_id is null or p_igdb_id not between 1 and 9007199254740991 then
    raise exception 'Game id must be a positive safe integer' using errcode = '22023';
  end if;

  if p_name is null
    or p_name <> btrim(p_name)
    or char_length(p_name) not between 1 and 200
  then
    raise exception 'Game name must be canonical and between 1 and 200 characters'
      using errcode = '22023';
  end if;

  if p_cover_url is not null and (
    p_cover_url <> btrim(p_cover_url)
    or char_length(p_cover_url) > 2048
    or p_cover_url !~ '^https://images[.]igdb[.]com/igdb/image/upload/t_cover_big_2x/[A-Za-z0-9_-]+[.]jpg$'
  ) then
    raise exception 'Cover URL must be a canonical IGDB cover URL' using errcode = '22023';
  end if;

  if p_release_date is null then
    raise exception 'Release date is required' using errcode = '22023';
  end if;

  select existing_list.id
  into v_list_id
  from public.lists as existing_list
  where existing_list.user_id = v_user_id
    and existing_list.system_key = 'want_to_play';

  if v_list_id is null and not p_desired then
    return false;
  end if;

  if v_list_id is null then
    insert into public.lists as created_list (user_id, name, system_key)
    values (v_user_id, 'Quero Jogar!', 'want_to_play')
    on conflict (user_id, system_key) where system_key is not null do nothing
    returning created_list.id into v_list_id;

    if v_list_id is null then
      select existing_list.id
      into strict v_list_id
      from public.lists as existing_list
      where existing_list.user_id = v_user_id
        and existing_list.system_key = 'want_to_play';
    end if;
  end if;

  perform 1
  from public.lists as locked_list
  where locked_list.id = v_list_id
  for update;

  if not p_desired then
    select stored_game.id
    into v_game_id
    from public.games as stored_game
    where stored_game.user_id = v_user_id
      and stored_game.igdb_id = p_igdb_id;

    if v_game_id is null then
      return false;
    end if;

    delete from public.list_items as wanted_item
    where wanted_item.list_id = v_list_id
      and wanted_item.game_id = v_game_id;

    return false;
  end if;

  insert into public.games (user_id, igdb_id, name, cover_url, release_date)
  values (v_user_id, p_igdb_id, p_name, p_cover_url, p_release_date)
  on conflict (user_id, igdb_id) do update
  set name = excluded.name,
      cover_url = excluded.cover_url,
      release_date = excluded.release_date;

  select stored_game.id
  into strict v_game_id
  from public.games as stored_game
  where stored_game.user_id = v_user_id
    and stored_game.igdb_id = p_igdb_id;

  insert into public.list_items (list_id, game_id)
  values (v_list_id, v_game_id)
  on conflict (list_id, game_id) do nothing;

  return true;
end;
$$;

create function public.enforce_list_name_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.system_key is not null then
    return new;
  end if;

  if pg_catalog.lower(pg_catalog.btrim(new.name)) = 'quero jogar!' then
    raise exception 'The list name is reserved for the want-to-play list'
      using errcode = '23514', constraint = 'lists_reserved_want_to_play_name';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  if exists (
    select 1
    from public.lists as existing_list
    where existing_list.user_id = new.user_id
      and existing_list.id is distinct from new.id
      and pg_catalog.lower(pg_catalog.btrim(existing_list.name)) =
        pg_catalog.lower(pg_catalog.btrim(new.name))
  ) then
    raise exception 'A list with this name already exists for the user'
      using errcode = '23505', constraint = 'lists_user_name_unique';
  end if;

  return new;
end;
$$;

create trigger lists_enforce_name_rules
before insert or update on public.lists
for each row execute function public.enforce_list_name_rules();

revoke all on function public.enforce_list_name_rules() from public, anon, authenticated;

commit;
