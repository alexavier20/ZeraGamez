begin;

create function public.move_tier_list_game(
  p_tier_list_id bigint,
  p_igdb_id bigint,
  p_tier text,
  p_position integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_tier text;
  v_existing_ids bigint[];
  v_ordered_ids bigint[];
  v_target_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_tier_list_id is null or p_tier_list_id not between 1 and 9007199254740991 then
    raise exception 'Tier list id must be a positive safe integer' using errcode = '22023';
  end if;

  if p_igdb_id is null or p_igdb_id not between 1 and 9007199254740991 then
    raise exception 'Game id must be a positive safe integer' using errcode = '22023';
  end if;

  if p_tier is not null and p_tier not in ('S', 'A', 'B', 'C', 'D') then
    raise exception 'Tier is invalid' using errcode = '22023';
  end if;

  if p_position is null or p_position < 0 then
    raise exception 'Position must be a nonnegative integer' using errcode = '22023';
  end if;

  perform 1
  from public.tier_lists as owner_list
  where owner_list.id = p_tier_list_id
    and owner_list.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Tier list is unavailable' using errcode = '42501';
  end if;

  select item.tier
  into v_source_tier
  from public.tier_list_items as item
  where item.tier_list_id = p_tier_list_id
    and item.igdb_id = p_igdb_id
  for update;

  if not found then
    raise exception 'Game is unavailable in this tier list' using errcode = '42501';
  end if;

  select coalesce(
    array_agg(item.igdb_id order by item.position, item.created_at, item.igdb_id),
    array[]::bigint[]
  )
  into v_existing_ids
  from public.tier_list_items as item
  where item.tier_list_id = p_tier_list_id
    and item.tier is not distinct from p_tier
    and item.igdb_id <> p_igdb_id;

  v_target_count := cardinality(v_existing_ids);
  if p_position > v_target_count then
    raise exception 'Position is outside this tier' using errcode = '22023';
  end if;

  select array_agg(ordered.igdb_id order by ordered.position)
  into v_ordered_ids
  from (
    select p_igdb_id as igdb_id, p_position as position
    union all
    select
      existing.igdb_id,
      (existing.ordinality - 1 + case when existing.ordinality - 1 >= p_position then 1 else 0 end)
    from unnest(v_existing_ids) with ordinality as existing(igdb_id, ordinality)
  ) as ordered;

  update public.tier_list_items as item
  set tier = p_tier,
      position = (ordered.ordinality - 1)::integer
  from unnest(v_ordered_ids) with ordinality as ordered(igdb_id, ordinality)
  where item.tier_list_id = p_tier_list_id
    and item.igdb_id = ordered.igdb_id;

  if v_source_tier is distinct from p_tier then
    with ordered_source as (
      select
        item.igdb_id,
        (row_number() over (order by item.position, item.created_at, item.igdb_id) - 1)::integer as position
      from public.tier_list_items as item
      where item.tier_list_id = p_tier_list_id
        and item.tier is not distinct from v_source_tier
    )
    update public.tier_list_items as item
    set position = ordered_source.position
    from ordered_source
    where item.tier_list_id = p_tier_list_id
      and item.igdb_id = ordered_source.igdb_id;
  end if;

  return true;
end;
$$;

revoke all on function public.move_tier_list_game(bigint, bigint, text, integer) from public, anon;
grant execute on function public.move_tier_list_game(bigint, bigint, text, integer) to authenticated;

commit;
