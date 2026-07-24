-- Personal member ratings for completed Adventures. A nullable author preserves
-- the contribution if an auth/profile record is later removed, matching the
-- shared-memory retention convention.
create table public.adventure_ratings (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null
    references public.adventures(id) on delete cascade,
  user_id uuid
    references public.profiles(id) on delete set null,
  rating smallint not null
    check (rating between 1 and 5),
  would_do_again boolean,
  note text
    check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adventure_ratings_adventure_user_key
    unique (adventure_id, user_id)
);

create index adventure_ratings_adventure_updated_idx
  on public.adventure_ratings(adventure_id, updated_at, id);
create index adventure_ratings_user_id_idx
  on public.adventure_ratings(user_id);

create trigger adventure_ratings_set_updated_at
before update on public.adventure_ratings
for each row execute function public.set_updated_at();

-- Extract the effective-end check already used by completed Memories so the
-- rating trigger and membership helper cannot drift into competing definitions.
create function private.is_adventure_complete(target_adventure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.adventures adventure
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
  );
$$;

revoke execute on function private.is_adventure_complete(uuid)
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
  select private.is_adventure_complete(target_adventure_id)
    and exists (
      select 1
      from public.adventures adventure
      join public.space_members membership
        on membership.space_id = adventure.space_id
      where adventure.id = target_adventure_id
        and membership.user_id = (select auth.uid())
    );
$$;

revoke execute on function private.is_completed_adventure_member(uuid)
  from public, anon;
grant execute on function private.is_completed_adventure_member(uuid)
  to authenticated;

create function private.guard_adventure_rating_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_adventure_complete(new.adventure_id) then
    raise exception 'Only completed Adventures can be rated'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_adventure_rating_completion()
  from public, anon, authenticated;

create trigger guard_adventure_rating_completion_before_write
before insert or update on public.adventure_ratings
for each row execute function private.guard_adventure_rating_completion();

alter table public.adventure_ratings enable row level security;

create policy "Members can read completed Adventure ratings"
on public.adventure_ratings for select to authenticated
using (private.is_completed_adventure_member(adventure_id));

create policy "Members can create their own completed Adventure rating"
on public.adventure_ratings for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_completed_adventure_member(adventure_id)
);

create policy "Members can update their own completed Adventure rating"
on public.adventure_ratings for update to authenticated
using (
  user_id = (select auth.uid())
  and private.is_completed_adventure_member(adventure_id)
)
with check (
  user_id = (select auth.uid())
  and private.is_completed_adventure_member(adventure_id)
);

create policy "Members can delete their own Adventure rating"
on public.adventure_ratings for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.adventures adventure
    where adventure.id = adventure_ratings.adventure_id
      and private.is_space_member(adventure.space_id)
  )
);

grant select, insert, update, delete
  on table public.adventure_ratings to authenticated;

create function public.save_adventure_rating(
  p_adventure_id uuid,
  p_rating smallint,
  p_would_do_again boolean default null,
  p_note text default null
)
returns public.adventure_ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_rating public.adventure_ratings;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.is_completed_adventure_member(p_adventure_id) then
    raise exception 'Only members can rate completed Adventures'
      using errcode = '42501';
  end if;

  insert into public.adventure_ratings (
    adventure_id,
    user_id,
    rating,
    would_do_again,
    note
  )
  values (
    p_adventure_id,
    caller_id,
    p_rating,
    p_would_do_again,
    nullif(btrim(p_note), '')
  )
  on conflict (adventure_id, user_id)
  do update set
    rating = excluded.rating,
    would_do_again = excluded.would_do_again,
    note = excluded.note
  returning * into saved_rating;

  return saved_rating;
end;
$$;

revoke execute on function public.save_adventure_rating(
  uuid, smallint, boolean, text
) from public, anon;
grant execute on function public.save_adventure_rating(
  uuid, smallint, boolean, text
) to authenticated;

alter publication supabase_realtime add table public.adventure_ratings;
