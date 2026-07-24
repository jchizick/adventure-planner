create table public.tags (
  id uuid primary key,
  slug text not null unique,
  label text not null,
  icon_key text not null,
  sort_order integer not null unique,
  created_at timestamptz not null default now(),
  constraint tags_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint tags_label_check
    check (nullif(btrim(label), '') is not null),
  constraint tags_icon_key_check
    check (icon_key in ('heart', 'users', 'paw-print', 'leaf', 'cloud-rain', 'repeat')),
  constraint tags_sort_order_check
    check (sort_order > 0)
);

create table public.idea_tags (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (idea_id, tag_id)
);

create table public.adventure_tags (
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (adventure_id, tag_id)
);

create index idea_tags_tag_id_idx on public.idea_tags(tag_id);
create index adventure_tags_tag_id_idx on public.adventure_tags(tag_id);

insert into public.tags (id, slug, label, icon_key, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', 'date-night', 'Date Night', 'heart', 1),
  ('00000000-0000-4000-8000-000000000002', 'friends-family', 'With Friends & Family', 'users', 2),
  ('00000000-0000-4000-8000-000000000003', 'archie-friendly', 'Archie-Friendly', 'paw-print', 3),
  ('00000000-0000-4000-8000-000000000004', 'seasonal', 'Seasonal', 'leaf', 4),
  ('00000000-0000-4000-8000-000000000005', 'rainy-day', 'Rainy Day', 'cloud-rain', 5),
  ('00000000-0000-4000-8000-000000000006', 'recurring', 'Recurring', 'repeat', 6)
on conflict (id) do update
set slug = excluded.slug,
    label = excluded.label,
    icon_key = excluded.icon_key,
    sort_order = excluded.sort_order;

-- Preserve recognized values from the legacy text-array column. Unknown values
-- remain in that column for lossless backward compatibility but are not exposed
-- by the curated tag UI.
insert into public.idea_tags (idea_id, tag_id)
select distinct idea.id, tag.id
from public.ideas idea
cross join lateral unnest(idea.tags) legacy_tag
join public.tags tag on tag.slug = case
  when lower(btrim(legacy_tag)) in ('date night', 'date-night') then 'date-night'
  when lower(btrim(legacy_tag)) in (
    'with friends & family', 'with friends and family', 'friends-family'
  ) then 'friends-family'
  when lower(btrim(legacy_tag)) in ('archie friendly', 'archie-friendly') then 'archie-friendly'
  when lower(btrim(legacy_tag)) = 'seasonal' then 'seasonal'
  when lower(btrim(legacy_tag)) in ('rainy day', 'rainy-day') then 'rainy-day'
  when lower(btrim(legacy_tag)) = 'recurring' then 'recurring'
  else null
end
on conflict do nothing;

-- The legacy Date Night checkbox and any still-unmigrated Date Night category
-- both become the curated Date Night assignment.
insert into public.idea_tags (idea_id, tag_id)
select idea.id, tag.id
from public.ideas idea
cross join public.tags tag
where tag.slug = 'date-night'
  and (
    idea.is_date_night
    or lower(btrim(idea.category)) in ('dates', 'date night', 'date-night')
  )
on conflict do nothing;

-- A source Idea is the only durable Date Night signal available for previously
-- promoted Adventures. Direct legacy category values are also handled for
-- databases that did not encounter the earlier canonicalization migration.
insert into public.adventure_tags (adventure_id, tag_id)
select adventure.id, tag.id
from public.adventures adventure
cross join public.tags tag
left join public.ideas source_idea on source_idea.id = adventure.source_idea_id
where tag.slug = 'date-night'
  and (
    lower(btrim(adventure.category)) in ('dates', 'date night', 'date-night')
    or source_idea.is_date_night
    or exists (
      select 1
      from public.idea_tags source_tag
      where source_tag.idea_id = source_idea.id
        and source_tag.tag_id = tag.id
    )
  )
on conflict do nothing;

-- A legacy primary Date Night category did not describe an activity type, so
-- Social is the deterministic neutral fallback. Existing independently chosen
-- valid categories are preserved.
update public.ideas
set category = 'social'
where lower(btrim(category)) in ('dates', 'date night', 'date-night');

update public.adventures
set category = 'social'
where lower(btrim(category)) in ('dates', 'date night', 'date-night');

update public.ideas
set category = 'social'
where category not in (
  'food-drink', 'music-events', 'outdoors', 'culture', 'at-home',
  'trips-getaways', 'social', 'errands'
);

update public.adventures
set category = 'social'
where category is null
   or category not in (
     'food-drink', 'music-events', 'outdoors', 'culture', 'at-home',
     'trips-getaways', 'social', 'errands'
   );

alter table public.ideas
  add constraint ideas_category_check
  check (
    category in (
      'food-drink', 'music-events', 'outdoors', 'culture', 'at-home',
      'trips-getaways', 'social', 'errands'
    )
  ) not valid;

alter table public.ideas validate constraint ideas_category_check;

alter table public.adventures
  drop constraint adventures_category_check;

alter table public.adventures
  alter column category set not null;

alter table public.adventures
  add constraint adventures_category_check
  check (
    category in (
      'food-drink', 'music-events', 'outdoors', 'culture', 'at-home',
      'trips-getaways', 'social', 'errands'
    )
  ) not valid;

alter table public.adventures validate constraint adventures_category_check;

alter table public.tags enable row level security;
alter table public.idea_tags enable row level security;
alter table public.adventure_tags enable row level security;

create policy "Authenticated users can read curated tags"
on public.tags for select to authenticated
using ((select auth.uid()) is not null);

create policy "Members can read Idea tag assignments"
on public.idea_tags for select to authenticated
using (
  exists (
    select 1
    from public.ideas idea
    where idea.id = idea_tags.idea_id
      and private.is_space_member(idea.space_id)
  )
);

create policy "Members can add Idea tag assignments"
on public.idea_tags for insert to authenticated
with check (
  exists (
    select 1
    from public.ideas idea
    where idea.id = idea_tags.idea_id
      and private.is_space_member(idea.space_id)
  )
);

create policy "Members can remove Idea tag assignments"
on public.idea_tags for delete to authenticated
using (
  exists (
    select 1
    from public.ideas idea
    where idea.id = idea_tags.idea_id
      and private.is_space_member(idea.space_id)
  )
);

create policy "Members can read Adventure tag assignments"
on public.adventure_tags for select to authenticated
using (
  exists (
    select 1
    from public.adventures adventure
    where adventure.id = adventure_tags.adventure_id
      and private.is_space_member(adventure.space_id)
  )
);

create policy "Members can add Adventure tag assignments"
on public.adventure_tags for insert to authenticated
with check (
  exists (
    select 1
    from public.adventures adventure
    where adventure.id = adventure_tags.adventure_id
      and private.is_space_member(adventure.space_id)
  )
);

create policy "Members can remove Adventure tag assignments"
on public.adventure_tags for delete to authenticated
using (
  exists (
    select 1
    from public.adventures adventure
    where adventure.id = adventure_tags.adventure_id
      and private.is_space_member(adventure.space_id)
  )
);

revoke all on table public.tags from anon, authenticated;
revoke all on table public.idea_tags from anon, authenticated;
revoke all on table public.adventure_tags from anon, authenticated;
grant select on table public.tags to authenticated;
grant select, insert, delete on table public.idea_tags to authenticated;
grant select, insert, delete on table public.adventure_tags to authenticated;

create function public.set_idea_tags(p_idea_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_space_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select idea.space_id
  into target_space_id
  from public.ideas idea
  where idea.id = p_idea_id;

  if target_space_id is null
    or not (select private.is_space_member(target_space_id)) then
    raise exception 'Idea not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) requested_id
    left join public.tags tag on tag.id = requested_id
    where tag.id is null
  ) then
    raise exception 'Unknown tag' using errcode = '22023';
  end if;

  delete from public.idea_tags
  where idea_id = p_idea_id
    and tag_id <> all(coalesce(p_tag_ids, '{}'::uuid[]));

  insert into public.idea_tags (idea_id, tag_id)
  select p_idea_id, requested_id
  from (
    select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) requested_id
  ) requested
  on conflict do nothing;
end;
$$;

create function public.set_adventure_tags(p_adventure_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_space_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select adventure.space_id
  into target_space_id
  from public.adventures adventure
  where adventure.id = p_adventure_id;

  if target_space_id is null
    or not (select private.is_space_member(target_space_id)) then
    raise exception 'Adventure not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) requested_id
    left join public.tags tag on tag.id = requested_id
    where tag.id is null
  ) then
    raise exception 'Unknown tag' using errcode = '22023';
  end if;

  delete from public.adventure_tags
  where adventure_id = p_adventure_id
    and tag_id <> all(coalesce(p_tag_ids, '{}'::uuid[]));

  insert into public.adventure_tags (adventure_id, tag_id)
  select p_adventure_id, requested_id
  from (
    select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) requested_id
  ) requested
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_idea_tags(uuid, uuid[]) from public, anon;
grant execute on function public.set_idea_tags(uuid, uuid[]) to authenticated;
revoke execute on function public.set_adventure_tags(uuid, uuid[]) from public, anon;
grant execute on function public.set_adventure_tags(uuid, uuid[]) to authenticated;

create function public.promote_idea_to_adventure_v5(
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
  p_cover_storage_path text default null,
  p_tag_ids uuid[] default '{}'::uuid[]
)
returns public.adventures
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_adventure public.adventures;
begin
  created_adventure := public.promote_idea_to_adventure_v4(
    p_idea_id, p_title, p_description, p_event_date, p_end_date,
    p_start_time, p_end_time, p_status, p_location, p_latitude, p_longitude,
    p_timezone, p_geocoded_location, p_location_provider,
    p_location_provider_id, p_location_address, p_location_source,
    p_location_confirmed_at, p_notes, p_category, p_cover_image_url,
    p_cover_storage_path
  );

  if exists (
    select 1
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) requested_id
    left join public.tags tag on tag.id = requested_id
    where tag.id is null
  ) then
    raise exception 'Unknown tag' using errcode = '22023';
  end if;

  insert into public.adventure_tags (adventure_id, tag_id)
  select created_adventure.id, requested_id
  from (
    select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) requested_id
  ) requested
  on conflict do nothing;

  return created_adventure;
end;
$$;

revoke execute on function public.promote_idea_to_adventure_v5(
  uuid,text,text,date,date,time,time,text,text,double precision,double precision,
  text,text,text,text,jsonb,jsonb,timestamptz,text,text,text,text,uuid[]
) from public, anon;
grant execute on function public.promote_idea_to_adventure_v5(
  uuid,text,text,date,date,time,time,text,text,double precision,double precision,
  text,text,text,text,jsonb,jsonb,timestamptz,text,text,text,text,uuid[]
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
    source_adventure.space_id, null, source_adventure.title || ' Copy',
    source_adventure.description, source_adventure.category, 'tentative',
    source_adventure.event_date, source_adventure.end_date,
    source_adventure.start_time, source_adventure.end_time,
    source_adventure.location, source_adventure.latitude,
    source_adventure.longitude, source_adventure.timezone,
    source_adventure.geocoded_location, source_adventure.location_provider,
    source_adventure.location_provider_id, source_adventure.location_address,
    source_adventure.location_source, source_adventure.location_confirmed_at,
    source_adventure.notes,
    case when source_adventure.cover_storage_path is null
      then source_adventure.cover_image_url else null end,
    case when source_adventure.cover_storage_path is null
      and source_adventure.cover_image_url is null
      then source_adventure.cover_variant else null end,
    source_adventure.cover_storage_path, false, null, caller_id, caller_id
  )
  returning id into duplicate_id;

  insert into public.adventure_stops (
    adventure_id, title, day_date, location, latitude, longitude, timezone,
    geocoded_location, location_provider, location_provider_id,
    location_address, location_source, location_confirmed_at, start_time,
    end_time, notes, sort_order, travel_time_minutes
  )
  select duplicate_id, stop.title, stop.day_date, stop.location, stop.latitude,
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

  insert into public.adventure_tags (adventure_id, tag_id)
  select duplicate_id, assignment.tag_id
  from public.adventure_tags assignment
  where assignment.adventure_id = p_adventure_id
  on conflict do nothing;

  return duplicate_id;
end;
$$;

revoke execute on function public.duplicate_adventure(uuid) from public, anon;
grant execute on function public.duplicate_adventure(uuid) to authenticated;
