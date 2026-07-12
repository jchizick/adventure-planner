create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  status text not null check (status in ('idea', 'tentative', 'confirmed')),
  tags text[] not null default '{}',
  optional_link text,
  image_url text,
  location text,
  added_by uuid not null references public.profiles(id),
  linked_adventure_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adventures (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  source_idea_id uuid references public.ideas(id) on delete set null,
  title text not null,
  description text,
  category text,
  status text not null check (status in ('tentative', 'confirmed', 'completed')),
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  notes text,
  cover_image_url text,
  is_favorite boolean not null default false,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ideas
  add constraint ideas_linked_adventure_id_fkey
  foreign key (linked_adventure_id)
  references public.adventures(id)
  on delete set null;

create table public.adventure_stops (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  title text not null,
  location text,
  start_time time,
  end_time time,
  notes text,
  sort_order integer not null check (sort_order >= 0),
  travel_time_minutes integer check (
    travel_time_minutes is null or travel_time_minutes >= 0
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adventure_stops_adventure_sort_order_key
    unique (adventure_id, sort_order) deferrable initially immediate
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  label text not null,
  is_complete boolean not null default false,
  sort_order integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adventure_links (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index space_members_user_id_idx on public.space_members(user_id);
create index ideas_space_id_idx on public.ideas(space_id);
create index ideas_added_by_idx on public.ideas(added_by);
create index ideas_status_idx on public.ideas(status);
create index adventures_space_id_idx on public.adventures(space_id);
create index adventures_event_date_idx on public.adventures(event_date);
create index adventures_source_idea_id_idx on public.adventures(source_idea_id);
create index adventure_stops_adventure_id_idx on public.adventure_stops(adventure_id);
create index checklist_items_adventure_id_idx on public.checklist_items(adventure_id);
create index adventure_links_adventure_id_idx on public.adventure_links(adventure_id);

create function private.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members
    where space_id = target_space_id
      and user_id = (select auth.uid())
  );
$$;

create function private.is_space_owner(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members
    where space_id = target_space_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create function private.shares_space_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = (select auth.uid()) or exists (
    select 1
    from public.space_members viewer
    join public.space_members target on target.space_id = viewer.space_id
    where viewer.user_id = (select auth.uid())
      and target.user_id = target_user_id
  );
$$;

create function private.is_adventure_member(target_adventure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.adventures adventure
    join public.space_members membership on membership.space_id = adventure.space_id
    where adventure.id = target_adventure_id
      and membership.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_space_member(uuid) from public, anon;
revoke execute on function private.is_space_owner(uuid) from public, anon;
revoke execute on function private.shares_space_with(uuid) from public, anon;
revoke execute on function private.is_adventure_member(uuid) from public, anon;
grant execute on function private.is_space_member(uuid) to authenticated;
grant execute on function private.is_space_owner(uuid) to authenticated;
grant execute on function private.shares_space_with(uuid) to authenticated;
grant execute on function private.is_adventure_member(uuid) to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      'Adventure planner'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create function public.handle_new_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.space_members (space_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_space() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger spaces_set_updated_at before update on public.spaces
for each row execute function public.set_updated_at();
create trigger ideas_set_updated_at before update on public.ideas
for each row execute function public.set_updated_at();
create trigger adventures_set_updated_at before update on public.adventures
for each row execute function public.set_updated_at();
create trigger adventure_stops_set_updated_at before update on public.adventure_stops
for each row execute function public.set_updated_at();
create trigger checklist_items_set_updated_at before update on public.checklist_items
for each row execute function public.set_updated_at();
create trigger adventure_links_set_updated_at before update on public.adventure_links
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_space_created
after insert on public.spaces
for each row execute function public.handle_new_space();

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.ideas enable row level security;
alter table public.adventures enable row level security;
alter table public.adventure_stops enable row level security;
alter table public.checklist_items enable row level security;
alter table public.adventure_links enable row level security;

create policy "Profiles are visible within shared spaces"
on public.profiles for select to authenticated
using ((select private.shares_space_with(id)));

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Members can read spaces"
on public.spaces for select to authenticated
using ((select private.is_space_member(id)));

create policy "Authenticated users can create their own spaces"
on public.spaces for insert to authenticated
with check ((select auth.uid()) = created_by);

create policy "Owners can update spaces"
on public.spaces for update to authenticated
using ((select private.is_space_owner(id)))
with check ((select private.is_space_owner(id)));

create policy "Members can read space memberships"
on public.space_members for select to authenticated
using ((select private.is_space_member(space_id)));

create policy "Owners can add space members"
on public.space_members for insert to authenticated
with check ((select private.is_space_owner(space_id)));

create policy "Owners can remove space members"
on public.space_members for delete to authenticated
using ((select private.is_space_owner(space_id)));

create policy "Members can read ideas"
on public.ideas for select to authenticated
using ((select private.is_space_member(space_id)));
create policy "Members can create ideas"
on public.ideas for insert to authenticated
with check (
  (select private.is_space_member(space_id))
  and added_by = (select auth.uid())
);
create policy "Members can update ideas"
on public.ideas for update to authenticated
using ((select private.is_space_member(space_id)))
with check ((select private.is_space_member(space_id)));
create policy "Members can delete ideas"
on public.ideas for delete to authenticated
using ((select private.is_space_member(space_id)));

create policy "Members can read adventures"
on public.adventures for select to authenticated
using ((select private.is_space_member(space_id)));
create policy "Members can create adventures"
on public.adventures for insert to authenticated
with check (
  (select private.is_space_member(space_id))
  and created_by = (select auth.uid())
);
create policy "Members can update adventures"
on public.adventures for update to authenticated
using ((select private.is_space_member(space_id)))
with check ((select private.is_space_member(space_id)));
create policy "Members can delete adventures"
on public.adventures for delete to authenticated
using ((select private.is_space_member(space_id)));

create policy "Members can read adventure stops"
on public.adventure_stops for select to authenticated
using ((select private.is_adventure_member(adventure_id)));
create policy "Members can create adventure stops"
on public.adventure_stops for insert to authenticated
with check ((select private.is_adventure_member(adventure_id)));
create policy "Members can update adventure stops"
on public.adventure_stops for update to authenticated
using ((select private.is_adventure_member(adventure_id)))
with check ((select private.is_adventure_member(adventure_id)));
create policy "Members can delete adventure stops"
on public.adventure_stops for delete to authenticated
using ((select private.is_adventure_member(adventure_id)));

create policy "Members can read checklist items"
on public.checklist_items for select to authenticated
using ((select private.is_adventure_member(adventure_id)));
create policy "Members can create checklist items"
on public.checklist_items for insert to authenticated
with check (
  (select private.is_adventure_member(adventure_id))
  and created_by = (select auth.uid())
);
create policy "Members can update checklist items"
on public.checklist_items for update to authenticated
using ((select private.is_adventure_member(adventure_id)))
with check ((select private.is_adventure_member(adventure_id)));
create policy "Members can delete checklist items"
on public.checklist_items for delete to authenticated
using ((select private.is_adventure_member(adventure_id)));

create policy "Members can read adventure links"
on public.adventure_links for select to authenticated
using ((select private.is_adventure_member(adventure_id)));
create policy "Members can create adventure links"
on public.adventure_links for insert to authenticated
with check ((select private.is_adventure_member(adventure_id)));
create policy "Members can update adventure links"
on public.adventure_links for update to authenticated
using ((select private.is_adventure_member(adventure_id)))
with check ((select private.is_adventure_member(adventure_id)));
create policy "Members can delete adventure links"
on public.adventure_links for delete to authenticated
using ((select private.is_adventure_member(adventure_id)));

grant select, update on table public.profiles to authenticated;
grant select, insert on table public.spaces to authenticated;
grant update (name) on table public.spaces to authenticated;
grant select, insert, delete on table public.space_members to authenticated;
grant select, insert, update, delete on table public.ideas to authenticated;
grant select, insert, update, delete on table public.adventures to authenticated;
grant select, insert, update, delete on table public.adventure_stops to authenticated;
grant select, insert, update, delete on table public.checklist_items to authenticated;
grant select, insert, update, delete on table public.adventure_links to authenticated;
