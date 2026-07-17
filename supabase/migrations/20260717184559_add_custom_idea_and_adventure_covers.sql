alter table public.ideas
  add column cover_storage_path text;

alter table public.adventures
  add column cover_storage_path text;

alter table public.ideas
  add constraint ideas_cover_storage_path_scoped_check check (
    cover_storage_path is null
    or cover_storage_path like 'spaces/' || space_id::text || '/%'
  );

alter table public.adventures
  add constraint adventures_cover_storage_path_scoped_check check (
    cover_storage_path is null
    or cover_storage_path like 'spaces/' || space_id::text || '/%'
  );

create index ideas_cover_storage_path_idx
  on public.ideas(cover_storage_path)
  where cover_storage_path is not null;

create index adventures_cover_storage_path_idx
  on public.adventures(cover_storage_path)
  where cover_storage_path is not null;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cover-images',
  'cover-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function private.can_access_cover_path(path_space_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when path_space_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_space_member(path_space_id::uuid)
    else false
  end;
$$;

revoke execute on function private.can_access_cover_path(text)
  from public, anon;
grant execute on function private.can_access_cover_path(text)
  to authenticated;

create policy "Members can read cover objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'cover-images'
  and name ~* '^spaces/[0-9a-f-]+/(ideas|adventures)/[0-9a-f-]+/cover/[0-9a-f-]+\.(jpg|jpeg|png|webp)$'
  and private.can_access_cover_path(split_part(name, '/', 2))
);

create policy "Members can upload cover objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cover-images'
  and name ~* '^spaces/[0-9a-f-]+/(ideas|adventures)/[0-9a-f-]+/cover/[0-9a-f-]+\.(jpg|jpeg|png|webp)$'
  and private.can_access_cover_path(split_part(name, '/', 2))
);

create policy "Members can delete cover objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'cover-images'
  and name ~* '^spaces/[0-9a-f-]+/(ideas|adventures)/[0-9a-f-]+/cover/[0-9a-f-]+\.(jpg|jpeg|png|webp)$'
  and private.can_access_cover_path(split_part(name, '/', 2))
);

create function public.promote_idea_to_adventure_v4(
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
  p_cover_image_url text default null,
  p_cover_storage_path text default null
)
returns public.adventures
language plpgsql security definer set search_path = ''
as $$
declare
  created_adventure public.adventures;
  source_cover_storage_path text;
begin
  select idea.cover_storage_path
    into source_cover_storage_path
    from public.ideas idea
    where idea.id = p_idea_id;

  created_adventure := public.promote_idea_to_adventure_v3(
    p_idea_id, p_title, p_description, p_event_date, p_end_date,
    p_start_time, p_end_time, p_status, p_location, p_latitude, p_longitude,
    p_timezone, p_geocoded_location, p_location_provider,
    p_location_provider_id, p_location_address, p_location_source,
    p_location_confirmed_at, p_notes, p_category,
    case when coalesce(p_cover_storage_path, source_cover_storage_path) is null
      then p_cover_image_url else null end
  );

  if coalesce(p_cover_storage_path, source_cover_storage_path) is not null then
    update public.adventures
      set cover_storage_path = coalesce(p_cover_storage_path, source_cover_storage_path),
          cover_image_url = null,
          cover_variant = null
      where id = created_adventure.id
      returning * into created_adventure;
  end if;

  return created_adventure;
end;
$$;

revoke execute on function public.promote_idea_to_adventure_v4(
  uuid,text,text,date,date,time,time,text,text,double precision,double precision,
  text,text,text,text,jsonb,jsonb,timestamptz,text,text,text,text
) from public, anon;
grant execute on function public.promote_idea_to_adventure_v4(
  uuid,text,text,date,date,time,time,text,text,double precision,double precision,
  text,text,text,text,jsonb,jsonb,timestamptz,text,text,text,text
) to authenticated;

create or replace function public.duplicate_adventure(p_adventure_id uuid)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  source_adventure public.adventures%rowtype;
  duplicate_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select adventure.* into source_adventure from public.adventures adventure where adventure.id = p_adventure_id;
  if source_adventure.id is null or not (select private.is_space_member(source_adventure.space_id)) then
    raise exception 'Adventure not found' using errcode = 'P0002';
  end if;
  insert into public.adventures (
    space_id, source_idea_id, title, description, category, status,
    event_date, end_date, start_time, end_time, location, latitude, longitude, timezone,
    geocoded_location, location_provider, location_provider_id, location_address,
    location_source, location_confirmed_at, notes, cover_image_url, cover_variant,
    cover_storage_path, is_favorite, completed_at, created_by, updated_by
  ) values (
    source_adventure.space_id, null, source_adventure.title || ' Copy',
    source_adventure.description, source_adventure.category, 'tentative',
    source_adventure.event_date, source_adventure.end_date, source_adventure.start_time,
    source_adventure.end_time, source_adventure.location, source_adventure.latitude,
    source_adventure.longitude, source_adventure.timezone, source_adventure.geocoded_location,
    source_adventure.location_provider, source_adventure.location_provider_id,
    source_adventure.location_address, source_adventure.location_source,
    source_adventure.location_confirmed_at, source_adventure.notes,
    case when source_adventure.cover_storage_path is null then source_adventure.cover_image_url else null end,
    case when source_adventure.cover_storage_path is null and source_adventure.cover_image_url is null
      then source_adventure.cover_variant else null end,
    source_adventure.cover_storage_path, false, null, caller_id, caller_id
  ) returning id into duplicate_id;

  insert into public.adventure_stops (
    adventure_id, title, location, latitude, longitude, timezone, geocoded_location,
    location_provider, location_provider_id, location_address, location_source,
    location_confirmed_at, start_time, end_time, notes, sort_order, travel_time_minutes
  ) select duplicate_id, stop.title, stop.location, stop.latitude, stop.longitude,
    stop.timezone, stop.geocoded_location, stop.location_provider, stop.location_provider_id,
    stop.location_address, stop.location_source, stop.location_confirmed_at, stop.start_time,
    stop.end_time, stop.notes, stop.sort_order, stop.travel_time_minutes
  from public.adventure_stops stop where stop.adventure_id = p_adventure_id order by stop.sort_order;

  insert into public.checklist_items (adventure_id, label, is_complete, sort_order, created_by)
  select duplicate_id, item.label, false, item.sort_order, caller_id
  from public.checklist_items item where item.adventure_id = p_adventure_id order by item.sort_order;
  insert into public.adventure_links (adventure_id, label, url, sort_order)
  select duplicate_id, link.label, link.url, link.sort_order
  from public.adventure_links link where link.adventure_id = p_adventure_id order by link.sort_order;
  return duplicate_id;
end;
$$;
