create function public.reorder_checklist_items(
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

  select count(*) into expected_count
  from public.checklist_items
  where adventure_id = p_adventure_id;

  select count(distinct item_id) into distinct_count
  from unnest(coalesce(p_ordered_ids, '{}'::uuid[])) item_id;

  if supplied_count <> expected_count or distinct_count <> supplied_count then
    raise exception 'Ordered checklist IDs must contain every item exactly once'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_ordered_ids, '{}'::uuid[])) item_id
    left join public.checklist_items item
      on item.id = item_id and item.adventure_id = p_adventure_id
    where item.id is null
  ) then
    raise exception 'Ordered checklist IDs must belong to the Adventure'
      using errcode = '22023';
  end if;

  update public.checklist_items item
  set sort_order = ordered.ordinality::integer
  from unnest(coalesce(p_ordered_ids, '{}'::uuid[]))
    with ordinality as ordered(id, ordinality)
  where item.id = ordered.id
    and item.adventure_id = p_adventure_id;
end;
$$;

revoke all on function public.reorder_checklist_items(uuid, uuid[]) from public;
revoke all on function public.reorder_checklist_items(uuid, uuid[]) from anon;
grant execute on function public.reorder_checklist_items(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_checklist_items(uuid, uuid[]) to service_role;
