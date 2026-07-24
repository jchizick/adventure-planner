-- Allow a single-day Adventure to have an explicit end time while preserving
-- legacy rows that may not yet satisfy the stricter time dependencies.
alter table public.adventures
  drop constraint if exists adventures_same_day_time_order_check;

alter table public.adventures
  add constraint adventures_end_time_requires_start_time_check
    check (end_time is null or start_time is not null) not valid,
  add constraint adventures_same_day_time_order_check check (
    start_time is null or end_time is null
    or coalesce(end_date, event_date) <> event_date
    or end_time > start_time
  ) not valid;

-- Every stop belongs to a concrete calendar day. Existing stops start on Day 1.
alter table public.adventure_stops
  add column day_date date;

update public.adventure_stops stop
set day_date = adventure.event_date
from public.adventures adventure
where adventure.id = stop.adventure_id;

create function private.set_and_validate_adventure_stop_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  adventure_start date;
  adventure_end date;
begin
  select adventure.event_date, coalesce(adventure.end_date, adventure.event_date)
    into adventure_start, adventure_end
    from public.adventures adventure
    where adventure.id = new.adventure_id;

  if adventure_start is null then
    raise exception 'Adventure not found' using errcode = 'P0002';
  end if;

  new.day_date := coalesce(new.day_date, adventure_start);
  if new.day_date < adventure_start or new.day_date > adventure_end then
    raise exception 'Itinerary stop day must be within the Adventure date range'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke execute on function private.set_and_validate_adventure_stop_day()
  from public, anon, authenticated;

create trigger set_and_validate_adventure_stop_day_before_write
before insert or update of adventure_id, day_date on public.adventure_stops
for each row execute function private.set_and_validate_adventure_stop_day();

alter table public.adventure_stops
  alter column day_date set not null;

create index adventure_stops_adventure_day_order_idx
  on public.adventure_stops(adventure_id, day_date, sort_order);

-- Preserve each stop's relative day when the Adventure start date moves.
-- Shrinking a range is rejected if it would strand a stop on a removed day.
create function private.guard_adventure_stop_days_before_range_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  new_last_offset integer;
  affected_titles text;
begin
  if old.event_date is not distinct from new.event_date
    and old.end_date is not distinct from new.end_date then
    return new;
  end if;

  new_last_offset := coalesce(new.end_date, new.event_date) - new.event_date;
  select string_agg(stop.title, ', ' order by stop.sort_order)
    into affected_titles
    from public.adventure_stops stop
    where stop.adventure_id = old.id
      and (
        stop.day_date - old.event_date < 0
        or stop.day_date - old.event_date > new_last_offset
      );

  if affected_titles is not null then
    raise exception
      'Reassign or delete itinerary stops on removed days first: %',
      affected_titles
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_adventure_stop_days_before_range_change()
  from public, anon, authenticated;

create trigger guard_adventure_stop_days_before_range_change
before update of event_date, end_date on public.adventures
for each row execute function private.guard_adventure_stop_days_before_range_change();

create function private.shift_adventure_stop_days_after_start_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.event_date is distinct from new.event_date then
    update public.adventure_stops stop
      set day_date = new.event_date + (stop.day_date - old.event_date)
      where stop.adventure_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.shift_adventure_stop_days_after_start_change()
  from public, anon, authenticated;

create trigger shift_adventure_stop_days_after_start_change
after update of event_date on public.adventures
for each row execute function private.shift_adventure_stop_days_after_start_change();

create or replace function private.guard_multiday_adventure_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.status = 'completed' or new.completed_at is not null)
    and not (old.status = 'completed' or old.completed_at is not null)
    and not (
      (
        new.end_time is not null
        and now() >= (
          (coalesce(new.end_date, new.event_date) + new.end_time)
          at time zone coalesce(nullif(new.timezone, ''), current_setting('TIMEZONE'))
        )
      )
      or (
        new.end_time is null
        and new.end_date is not null
        and (
          now() at time zone
          coalesce(nullif(new.timezone, ''), current_setting('TIMEZONE'))
        )::date > new.end_date
      )
      or (new.end_time is null and new.end_date is null)
    ) then
    raise exception 'An Adventure cannot be completed before its effective end'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_multiday_adventure_completion()
  from public, anon, authenticated;

create or replace function private.is_completed_adventure_member(
  target_adventure_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.adventures adventure
    join public.space_members membership
      on membership.space_id = adventure.space_id
    where adventure.id = target_adventure_id
      and (adventure.status = 'completed' or adventure.completed_at is not null)
      and (
        (
          adventure.end_time is not null
          and now() >= (
            (coalesce(adventure.end_date, adventure.event_date) + adventure.end_time)
            at time zone coalesce(
              nullif(adventure.timezone, ''),
              current_setting('TIMEZONE')
            )
          )
        )
        or (
          adventure.end_time is null
          and (
            adventure.end_date is null
            or (
              now() at time zone coalesce(
                nullif(adventure.timezone, ''),
                current_setting('TIMEZONE')
              )
            )::date > adventure.end_date
          )
        )
      )
      and membership.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_completed_adventure_member(uuid)
  from public, anon;
grant execute on function private.is_completed_adventure_member(uuid)
  to authenticated;

create or replace function private.can_access_adventure_photo_path(
  path_space_id text,
  path_adventure_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.adventures adventure
    join public.space_members membership
      on membership.space_id = adventure.space_id
    where adventure.id::text = path_adventure_id
      and adventure.space_id::text = path_space_id
      and (adventure.status = 'completed' or adventure.completed_at is not null)
      and (
        (
          adventure.end_time is not null
          and now() >= (
            (coalesce(adventure.end_date, adventure.event_date) + adventure.end_time)
            at time zone coalesce(
              nullif(adventure.timezone, ''),
              current_setting('TIMEZONE')
            )
          )
        )
        or (
          adventure.end_time is null
          and (
            adventure.end_date is null
            or (
              now() at time zone coalesce(
                nullif(adventure.timezone, ''),
                current_setting('TIMEZONE')
              )
            )::date > adventure.end_date
          )
        )
      )
      and membership.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.can_access_adventure_photo_path(text, text)
  from public, anon;
grant execute on function private.can_access_adventure_photo_path(text, text)
  to authenticated;

-- v4 delegates its core insert to v3, so keep the established signature and
-- update the validation at that boundary.
create or replace function public.promote_idea_to_adventure_v3(
  p_idea_id uuid,
  p_title text,
  p_description text,
  p_event_date date,
  p_end_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_status text default 'tentative',
  p_location text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_timezone text default null,
  p_geocoded_location text default null,
  p_location_provider text default null,
  p_location_provider_id text default null,
  p_location_address jsonb default null,
  p_location_source jsonb default null,
  p_location_confirmed_at timestamptz default null,
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
  normalized_idea_url text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Adventure title is required' using errcode = '22023';
  end if;
  if p_event_date is null then
    raise exception 'Adventure start date is required' using errcode = '22023';
  end if;
  if p_end_date is not null and p_end_date < p_event_date then
    raise exception 'Adventure end date must not precede its start date'
      using errcode = '22023';
  end if;
  if p_end_time is not null and p_start_time is null then
    raise exception 'Adventure end time requires a start time'
      using errcode = '22023';
  end if;
  if coalesce(p_end_date, p_event_date) = p_event_date
    and p_start_time is not null
    and p_end_time is not null
    and p_end_time <= p_start_time then
    raise exception 'Adventure end time must be after its start time'
      using errcode = '22023';
  end if;
  if p_status not in ('tentative', 'confirmed') then
    raise exception 'Invalid Adventure status' using errcode = '22023';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and p_latitude not between -90 and 90)
    or (p_longitude is not null and p_longitude not between -180 and 180) then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_location_confirmed_at is not null and (
    nullif(btrim(p_location), '') is null
    or p_latitude is null
    or nullif(btrim(p_location_provider), '') is null
    or nullif(btrim(p_location_provider_id), '') is null
    or nullif(btrim(p_geocoded_location), '') is null
    or p_location_address is null
    or jsonb_typeof(p_location_address) <> 'object'
    or p_location_address = '{}'::jsonb
    or p_location_source is null
    or jsonb_typeof(p_location_source) <> 'object'
    or nullif(btrim(p_location_source ->> 'name'), '') is null
    or nullif(btrim(p_location_source ->> 'attribution'), '') is null
  ) then
    raise exception 'Confirmed location details are incomplete'
      using errcode = '22023';
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
    space_id, source_idea_id, title, description, category, status,
    event_date, end_date, start_time, end_time, location, latitude, longitude,
    timezone, geocoded_location, location_provider, location_provider_id,
    location_address, location_source, location_confirmed_at, notes,
    cover_image_url, created_by, updated_by
  ) values (
    source_idea.space_id,
    source_idea.id,
    btrim(p_title),
    nullif(btrim(p_description), ''),
    coalesce(nullif(btrim(p_category), ''), source_idea.category),
    p_status,
    p_event_date,
    p_end_date,
    p_start_time,
    p_end_time,
    nullif(btrim(p_location), ''),
    p_latitude,
    p_longitude,
    nullif(btrim(p_timezone), ''),
    nullif(btrim(p_geocoded_location), ''),
    nullif(btrim(p_location_provider), ''),
    nullif(btrim(p_location_provider_id), ''),
    p_location_address,
    p_location_source,
    p_location_confirmed_at,
    nullif(btrim(p_notes), ''),
    nullif(btrim(p_cover_image_url), ''),
    current_user_id,
    current_user_id
  )
  returning * into created_adventure;

  normalized_idea_url := nullif(btrim(source_idea.optional_link), '');
  if normalized_idea_url is not null then
    if normalized_idea_url ~* '^https?://[^[:space:]]+$' then
      null;
    elsif normalized_idea_url !~* '^[a-z][a-z0-9+.-]*:'
      and normalized_idea_url ~*
        '^(www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,63}([/:?#][^[:space:]]*)?$' then
      normalized_idea_url := 'https://' || normalized_idea_url;
    else
      normalized_idea_url := null;
    end if;
  end if;

  if normalized_idea_url is not null then
    insert into public.adventure_links (adventure_id, label, url, sort_order)
    values (created_adventure.id, 'Website', normalized_idea_url, 1);
  end if;

  update public.ideas
    set linked_adventure_id = created_adventure.id,
        status = 'confirmed'
    where id = source_idea.id;

  return created_adventure;
end;
$$;

revoke execute on function public.promote_idea_to_adventure_v3(
  uuid, text, text, date, date, time, time, text, text,
  double precision, double precision, text, text, text, text,
  jsonb, jsonb, timestamptz, text, text, text
) from public, anon;
grant execute on function public.promote_idea_to_adventure_v3(
  uuid, text, text, date, date, time, time, text, text,
  double precision, double precision, text, text, text, text,
  jsonb, jsonb, timestamptz, text, text, text
) to authenticated;

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
    event_date, end_date, start_time, end_time, location, latitude, longitude,
    timezone, geocoded_location, location_provider, location_provider_id,
    location_address, location_source, location_confirmed_at, notes,
    cover_image_url, cover_variant, cover_storage_path, is_favorite,
    completed_at, created_by, updated_by
  ) values (
    source_adventure.space_id,
    null,
    source_adventure.title || ' Copy',
    source_adventure.description,
    source_adventure.category,
    'tentative',
    source_adventure.event_date,
    source_adventure.end_date,
    source_adventure.start_time,
    source_adventure.end_time,
    source_adventure.location,
    source_adventure.latitude,
    source_adventure.longitude,
    source_adventure.timezone,
    source_adventure.geocoded_location,
    source_adventure.location_provider,
    source_adventure.location_provider_id,
    source_adventure.location_address,
    source_adventure.location_source,
    source_adventure.location_confirmed_at,
    source_adventure.notes,
    case
      when source_adventure.cover_storage_path is null
        then source_adventure.cover_image_url
      else null
    end,
    case
      when source_adventure.cover_storage_path is null
        and source_adventure.cover_image_url is null
        then source_adventure.cover_variant
      else null
    end,
    source_adventure.cover_storage_path,
    false,
    null,
    caller_id,
    caller_id
  )
  returning id into duplicate_id;

  insert into public.adventure_stops (
    adventure_id, title, day_date, location, latitude, longitude, timezone,
    geocoded_location, location_provider, location_provider_id, location_address,
    location_source, location_confirmed_at, start_time, end_time, notes,
    sort_order, travel_time_minutes
  )
  select
    duplicate_id, stop.title, stop.day_date, stop.location, stop.latitude,
    stop.longitude, stop.timezone, stop.geocoded_location,
    stop.location_provider, stop.location_provider_id, stop.location_address,
    stop.location_source, stop.location_confirmed_at, stop.start_time,
    stop.end_time, stop.notes, stop.sort_order, stop.travel_time_minutes
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
