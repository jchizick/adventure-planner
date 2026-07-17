alter table public.adventures
  drop constraint adventures_category_check;

alter table public.adventures
  add constraint adventures_category_check
  check (
    category is null or category in (
      'food-drink',
      'music-events',
      'outdoors',
      'culture',
      'at-home',
      'trips-getaways',
      'social',
      'errands'
    )
  ) not valid;

alter table public.adventures
  validate constraint adventures_category_check;

create or replace function public.promote_idea_to_adventure_v2(
  p_idea_id uuid,
  p_title text,
  p_description text,
  p_event_date date,
  p_start_time time,
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
    event_date, start_time, end_time, location, latitude, longitude,
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
      and normalized_idea_url ~* '^(www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,63}([/:?#][^[:space:]]*)?$' then
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

revoke execute on function public.promote_idea_to_adventure_v2(
  uuid, text, text, date, time, time, text, text, double precision,
  double precision, text, text, text, text, jsonb, jsonb, timestamptz,
  text, text, text
) from public, anon;
grant execute on function public.promote_idea_to_adventure_v2(
  uuid, text, text, date, time, time, text, text, double precision,
  double precision, text, text, text, text, jsonb, jsonb, timestamptz,
  text, text, text
) to authenticated;
