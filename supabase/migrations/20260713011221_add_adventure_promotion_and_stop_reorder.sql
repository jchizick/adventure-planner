create function public.promote_idea_to_adventure(
  p_idea_id uuid,
  p_title text,
  p_description text,
  p_event_date date,
  p_start_time time,
  p_end_time time default null,
  p_status text default 'tentative',
  p_location text default null,
  p_notes text default null,
  p_category text default null,
  p_cover_image_url text default null
)
returns public.adventures
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  source_idea public.ideas;
  created_adventure public.adventures;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Adventure title is required' using errcode = '22023';
  end if;
  if p_event_date is null then
    raise exception 'Adventure date is required' using errcode = '22023';
  end if;
  if p_start_time is null then
    raise exception 'Adventure start time is required' using errcode = '22023';
  end if;
  if p_end_time is not null and p_end_time < p_start_time then
    raise exception 'Adventure end time must be after its start time'
      using errcode = '22023';
  end if;
  if p_status not in ('tentative', 'confirmed') then
    raise exception 'Invalid Adventure status' using errcode = '22023';
  end if;

  select idea.*
  into source_idea
  from public.ideas idea
  where idea.id = p_idea_id
  for update;

  if source_idea.id is null
    or not (select private.is_space_member(source_idea.space_id)) then
    raise exception 'Idea not found' using errcode = 'P0002';
  end if;
  if source_idea.linked_adventure_id is not null then
    raise exception 'Idea is already linked to an Adventure'
      using errcode = '23505';
  end if;

  insert into public.adventures (
    space_id,
    source_idea_id,
    title,
    description,
    category,
    status,
    event_date,
    start_time,
    end_time,
    location,
    notes,
    cover_image_url,
    created_by,
    updated_by
  ) values (
    source_idea.space_id,
    source_idea.id,
    btrim(p_title),
    nullif(btrim(p_description), ''),
    coalesce(nullif(btrim(p_category), ''), source_idea.category),
    p_status,
    p_event_date,
    p_start_time,
    p_end_time,
    nullif(btrim(p_location), ''),
    nullif(btrim(p_notes), ''),
    nullif(btrim(p_cover_image_url), ''),
    current_user_id,
    current_user_id
  )
  returning * into created_adventure;

  update public.ideas
  set linked_adventure_id = created_adventure.id,
      status = 'confirmed'
  where id = source_idea.id;

  return created_adventure;
end;
$$;

revoke execute on function public.promote_idea_to_adventure(
  uuid, text, text, date, time, time, text, text, text, text, text
) from public, anon;
grant execute on function public.promote_idea_to_adventure(
  uuid, text, text, date, time, time, text, text, text, text, text
) to authenticated;

create function public.reorder_adventure_stops(
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

  set constraints adventure_stops_adventure_sort_order_key deferred;

  update public.adventure_stops stop
  set sort_order = ordered.ordinality::integer
  from unnest(coalesce(p_ordered_ids, '{}'::uuid[]))
    with ordinality as ordered(id, ordinality)
  where stop.id = ordered.id
    and stop.adventure_id = p_adventure_id;
end;
$$;

revoke execute on function public.reorder_adventure_stops(uuid, uuid[])
from public, anon;
grant execute on function public.reorder_adventure_stops(uuid, uuid[])
to authenticated;
