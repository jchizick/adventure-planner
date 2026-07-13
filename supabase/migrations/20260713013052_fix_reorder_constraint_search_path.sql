create or replace function public.reorder_adventure_stops(
  p_adventure_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_count integer;
  supplied_count integer := coalesce(array_length(p_ordered_ids, 1), 0);
  distinct_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (select private.is_adventure_member(p_adventure_id)) then
    raise exception 'Adventure not found' using errcode = 'P0002';
  end if;

  select count(*)
  into expected_count
  from public.adventure_stops
  where adventure_id = p_adventure_id;

  select count(distinct stop_id)
  into distinct_count
  from unnest(coalesce(p_ordered_ids, '{}'::uuid[])) stop_id;

  if supplied_count <> expected_count or distinct_count <> supplied_count then
    raise exception 'Ordered stop IDs must contain every stop exactly once'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_ordered_ids, '{}'::uuid[])) stop_id
    left join public.adventure_stops stop
      on stop.id = stop_id
      and stop.adventure_id = p_adventure_id
    where stop.id is null
  ) then
    raise exception 'Ordered stop IDs must belong to the Adventure'
      using errcode = '22023';
  end if;

  set constraints public.adventure_stops_adventure_sort_order_key deferred;

  update public.adventure_stops stop
  set sort_order = ordered.ordinality::integer
  from unnest(coalesce(p_ordered_ids, '{}'::uuid[]))
    with ordinality as ordered(id, ordinality)
  where stop.id = ordered.id
    and stop.adventure_id = p_adventure_id;
end;
$$;
