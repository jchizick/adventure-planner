alter table public.adventures
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists timezone text,
  add column if not exists geocoded_location text;

alter table public.adventures
  drop constraint if exists adventures_latitude_check,
  drop constraint if exists adventures_longitude_check,
  drop constraint if exists adventures_coordinates_pair_check;

alter table public.adventures
  add constraint adventures_latitude_check
    check (latitude is null or latitude between -90 and 90),
  add constraint adventures_longitude_check
    check (longitude is null or longitude between -180 and 180),
  add constraint adventures_coordinates_pair_check
    check ((latitude is null) = (longitude is null));

create table public.adventure_weather_cache (
  adventure_id uuid primary key references public.adventures(id) on delete cascade,
  mode text not null check (mode in ('forecast', 'historical', 'too-early')),
  target_time text not null,
  request_fingerprint text not null,
  payload jsonb not null,
  provider text not null default 'open-meteo' check (provider = 'open-meteo'),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.adventure_weather_cache enable row level security;
revoke all on table public.adventure_weather_cache from anon, authenticated;
grant all on table public.adventure_weather_cache to service_role;

create index adventure_weather_cache_expires_at_idx
  on public.adventure_weather_cache(expires_at);

create function private.invalidate_adventure_weather_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.location is distinct from new.location
    or old.latitude is distinct from new.latitude
    or old.longitude is distinct from new.longitude
    or old.timezone is distinct from new.timezone
    or old.event_date is distinct from new.event_date
    or old.start_time is distinct from new.start_time
    or old.end_time is distinct from new.end_time
    or old.status is distinct from new.status
    or old.completed_at is distinct from new.completed_at then
    delete from public.adventure_weather_cache
    where adventure_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.invalidate_adventure_weather_cache()
  from public, anon, authenticated;

create trigger invalidate_adventure_weather_cache_after_schedule_change
after update on public.adventures
for each row execute function private.invalidate_adventure_weather_cache();

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
    event_date, start_time, end_time, location, latitude, longitude, timezone,
    geocoded_location, notes, cover_image_url, cover_variant, is_favorite,
    completed_at, created_by, updated_by
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
    source_adventure.latitude,
    source_adventure.longitude,
    source_adventure.timezone,
    source_adventure.geocoded_location,
    source_adventure.notes,
    source_adventure.cover_image_url,
    case when source_adventure.cover_image_url is null
      then source_adventure.cover_variant else null end,
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
