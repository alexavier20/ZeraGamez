begin;

create function public.delete_user_list(p_list_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game_ids bigint[];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_list_id is null or p_list_id not between 1 and 9007199254740991 then
    raise exception 'List id must be a positive safe integer' using errcode = '22023';
  end if;

  perform 1
  from public.lists as user_list
  where user_list.id = p_list_id
    and user_list.user_id = v_user_id
    and user_list.system_key is null
  for update;

  if not found then
    raise exception 'Custom list is unavailable' using errcode = '42501';
  end if;

  select coalesce(array_agg(list_item.game_id), array[]::bigint[])
  into v_game_ids
  from public.list_items as list_item
  join public.games as stored_game
    on stored_game.id = list_item.game_id
    and stored_game.user_id = v_user_id
  where list_item.list_id = p_list_id;

  delete from public.list_items as list_item
  where list_item.list_id = p_list_id;

  delete from public.games as stored_game
  where stored_game.user_id = v_user_id
    and stored_game.id = any(v_game_ids)
    and not exists (
      select 1
      from public.list_items as remaining_item
      where remaining_item.game_id = stored_game.id
    );

  delete from public.lists as user_list
  where user_list.id = p_list_id
    and user_list.user_id = v_user_id
    and user_list.system_key is null;

  return true;
end;
$$;

revoke all on function public.delete_user_list(bigint) from public, anon, authenticated;
grant execute on function public.delete_user_list(bigint) to authenticated;

commit;
