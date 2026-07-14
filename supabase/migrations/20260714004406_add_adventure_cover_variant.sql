-- Applied to the linked project as migration 20260714004406.
alter table public.adventures
  add column if not exists cover_variant smallint;

alter table public.adventures
  drop constraint if exists adventures_cover_variant_check;

alter table public.adventures
  add constraint adventures_cover_variant_check
  check (cover_variant is null or cover_variant in (1, 2, 3));

create or replace function public.duplicate_adventure(p_adventure_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  source_adventure public.adventures%rowtype;
  duplicate_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select adventure.*
  into source_adventure
  from public.adventures adventure
  where adventure.id = p_adventure_id;

  if source_adventure.id is null
    or not (select private.is_space_member(source_adventure.space_id)) then
    raise exception 'Adventure not found' using errcode = 'P0002';
  end if;

  insert into public.adventures (
    space_id, source_idea_id, title, description, category, status,
    event_date, start_time, end_time, location, notes, cover_image_url,
    cover_variant, is_favorite, completed_at, created_by, updated_by
  )
  values (
    source_adventure.space_id,
    null,
    source_adventure.title || ' Copy',
    source_adventure.description,
    source_adventure.category,
    'tentative',
    source_adventure.event_date,
    source_adventure.start_time,
    source_adventure.end_time,
    source_adventure.location,
    source_adventure.notes,
    source_adventure.cover_image_url,
    case
      when source_adventure.cover_image_url is null
        then source_adventure.cover_variant
      else null
    end,
    false,
    null,
    caller_id,
    caller_id
  )
  returning id into duplicate_id;

  insert into public.adventure_stops (
    adventure_id, title, location, start_time, end_time, notes,
    sort_order, travel_time_minutes
  )
  select
    duplicate_id, stop.title, stop.location, stop.start_time, stop.end_time,
    stop.notes, stop.sort_order, stop.travel_time_minutes
  from public.adventure_stops stop
  where stop.adventure_id = p_adventure_id
  order by stop.sort_order;

  insert into public.checklist_items (
    adventure_id, label, is_complete, sort_order, created_by
  )
  select duplicate_id, item.label, false, item.sort_order, caller_id
  from public.checklist_items item
  where item.adventure_id = p_adventure_id
  order by item.sort_order;

  insert into public.adventure_links (adventure_id, label, url, sort_order)
  select duplicate_id, link.label, link.url, link.sort_order
  from public.adventure_links link
  where link.adventure_id = p_adventure_id
  order by link.sort_order;

  return duplicate_id;
end;
$$;

revoke execute on function public.duplicate_adventure(uuid) from public, anon;
grant execute on function public.duplicate_adventure(uuid) to authenticated;
