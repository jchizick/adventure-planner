create table public.adventure_memories (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null unique
    references public.adventures(id) on delete cascade,
  reflection text not null default ''
    check (char_length(reflection) <= 2000),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adventure_photos (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null
    references public.adventures(id) on delete cascade,
  uploaded_by uuid not null
    references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  thumbnail_path text,
  caption text check (caption is null or char_length(caption) <= 500),
  sort_order integer not null check (sort_order >= 0),
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint adventure_photos_adventure_sort_order_key
    unique (adventure_id, sort_order) deferrable initially immediate
);

create index adventure_memories_updated_by_idx
  on public.adventure_memories(updated_by);
create index adventure_photos_adventure_id_idx
  on public.adventure_photos(adventure_id);
create index adventure_photos_uploaded_by_idx
  on public.adventure_photos(uploaded_by);

create trigger adventure_memories_set_updated_at
before update on public.adventure_memories
for each row execute function public.set_updated_at();

create function private.is_completed_adventure_member(target_adventure_id uuid)
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
      and membership.user_id = (select auth.uid())
  );
$$;

create function private.can_access_adventure_photo_path(
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
      and membership.user_id = (select auth.uid())
  );
$$;

create function private.can_manage_adventure_photo_path(
  path_space_id text,
  path_adventure_id text,
  object_owner_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select object_owner_id = (select auth.uid())::text
    or exists (
      select 1
      from public.adventures adventure
      join public.space_members membership
        on membership.space_id = adventure.space_id
      where adventure.id::text = path_adventure_id
        and adventure.space_id::text = path_space_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
    );
$$;

create function private.can_delete_adventure_photo(
  target_adventure_id uuid,
  uploader_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select uploader_id = (select auth.uid())
    or exists (
      select 1
      from public.adventures adventure
      join public.space_members membership
        on membership.space_id = adventure.space_id
      where adventure.id = target_adventure_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
    );
$$;

revoke execute on function private.is_completed_adventure_member(uuid)
  from public, anon;
revoke execute on function private.can_access_adventure_photo_path(text, text)
  from public, anon;
revoke execute on function private.can_manage_adventure_photo_path(text, text, text)
  from public, anon;
revoke execute on function private.can_delete_adventure_photo(uuid, uuid)
  from public, anon;
grant execute on function private.is_completed_adventure_member(uuid)
  to authenticated;
grant execute on function private.can_access_adventure_photo_path(text, text)
  to authenticated;
grant execute on function private.can_manage_adventure_photo_path(text, text, text)
  to authenticated;
grant execute on function private.can_delete_adventure_photo(uuid, uuid)
  to authenticated;

alter table public.adventure_memories enable row level security;
alter table public.adventure_photos enable row level security;

create policy "Members can read completed adventure memories"
on public.adventure_memories for select to authenticated
using (private.is_completed_adventure_member(adventure_id));

create policy "Members can create completed adventure memories"
on public.adventure_memories for insert to authenticated
with check (
  private.is_completed_adventure_member(adventure_id)
  and updated_by = (select auth.uid())
);

create policy "Members can update completed adventure memories"
on public.adventure_memories for update to authenticated
using (private.is_completed_adventure_member(adventure_id))
with check (
  private.is_completed_adventure_member(adventure_id)
  and updated_by = (select auth.uid())
);

create policy "Members can delete completed adventure memories"
on public.adventure_memories for delete to authenticated
using (private.is_completed_adventure_member(adventure_id));

create policy "Members can read completed adventure photos"
on public.adventure_photos for select to authenticated
using (private.is_completed_adventure_member(adventure_id));

create policy "Members can add completed adventure photos"
on public.adventure_photos for insert to authenticated
with check (
  private.is_completed_adventure_member(adventure_id)
  and uploaded_by = (select auth.uid())
);

create policy "Members can update completed adventure photos"
on public.adventure_photos for update to authenticated
using (private.is_completed_adventure_member(adventure_id))
with check (private.is_completed_adventure_member(adventure_id));

create policy "Uploaders and owners can delete adventure photos"
on public.adventure_photos for delete to authenticated
using (
  private.is_completed_adventure_member(adventure_id)
  and private.can_delete_adventure_photo(adventure_id, uploaded_by)
);

grant select, insert, update, delete
  on table public.adventure_memories to authenticated;
grant select, insert, update, delete
  on table public.adventure_photos to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'adventure-photos',
  'adventure-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can read adventure photo objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'adventure-photos'
  and (storage.foldername(name))[1] = 'spaces'
  and (storage.foldername(name))[3] = 'adventures'
  and private.can_access_adventure_photo_path(
    (storage.foldername(name))[2],
    (storage.foldername(name))[4]
  )
);

create policy "Members can upload adventure photo objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'adventure-photos'
  and (storage.foldername(name))[1] = 'spaces'
  and (storage.foldername(name))[3] = 'adventures'
  and private.can_access_adventure_photo_path(
    (storage.foldername(name))[2],
    (storage.foldername(name))[4]
  )
);

create policy "Uploaders and owners can delete adventure photo objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'adventure-photos'
  and (storage.foldername(name))[1] = 'spaces'
  and (storage.foldername(name))[3] = 'adventures'
  and private.can_manage_adventure_photo_path(
    (storage.foldername(name))[2],
    (storage.foldername(name))[4],
    owner_id
  )
);
