create table public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role = 'member'),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint space_invitations_normalized_email_check
    check (email = lower(btrim(email)) and email <> ''),
  constraint space_invitations_expiry_check check (expires_at > created_at),
  constraint space_invitations_acceptance_check check (
    (accepted_by is null and accepted_at is null)
    or (accepted_by is not null and accepted_at is not null)
  ),
  constraint space_invitations_state_check check (
    not (accepted_at is not null and revoked_at is not null)
  )
);

create index space_invitations_space_id_idx
  on public.space_invitations(space_id);
create index space_invitations_active_email_idx
  on public.space_invitations(space_id, email)
  where accepted_at is null and revoked_at is null;
create index space_invitations_invited_by_idx
  on public.space_invitations(invited_by);

create trigger space_invitations_set_updated_at
before update on public.space_invitations
for each row execute function public.set_updated_at();

alter table public.space_invitations enable row level security;

create policy "Owners can read space invitations"
on public.space_invitations for select to authenticated
using ((select private.is_space_owner(space_id)));

revoke all on table public.space_invitations from authenticated;
grant select (
  id, space_id, email, role, invited_by, accepted_by, accepted_at,
  revoked_at, expires_at, created_at, updated_at
) on table public.space_invitations to authenticated;
revoke insert, update, delete on table public.space_invitations from authenticated;
revoke all on table public.space_invitations from anon;

-- Membership mutations are intentionally RPC-only so an owner cannot use the
-- Data API to grant an unsupported owner role or bypass removal protections.
drop policy if exists "Owners can add space members" on public.space_members;
drop policy if exists "Owners can remove space members" on public.space_members;
revoke insert, delete on table public.space_members from authenticated;

create function public.create_space_invitation(
  p_space_id uuid,
  p_invitee_email text
)
returns table (
  invitation_id uuid,
  raw_token text,
  normalized_email text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  invite_email text := lower(btrim(coalesce(p_invitee_email, '')));
  invite_token text;
  created_invitation public.space_invitations%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not (select private.is_space_owner(p_space_id)) then
    raise exception 'Only the space owner can invite members.' using errcode = '42501';
  end if;
  if invite_email = '' or invite_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_space_id::text || ':' || invite_email, 0)
  );

  if exists (
    select 1
    from public.space_members member
    join auth.users account on account.id = member.user_id
    where member.space_id = p_space_id
      and lower(account.email) = invite_email
  ) then
    raise exception 'This person is already a member of the space.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.space_invitations invitation
    where invitation.space_id = p_space_id
      and invitation.email = invite_email
      and invitation.accepted_at is null
      and invitation.revoked_at is null
      and invitation.expires_at > now()
  ) then
    raise exception 'An active invitation already exists for this email.' using errcode = '23505';
  end if;

  invite_token := rtrim(
    translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  );

  insert into public.space_invitations (
    space_id, email, role, token_hash, invited_by, expires_at
  ) values (
    p_space_id,
    invite_email,
    'member',
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    caller_id,
    now() + interval '7 days'
  ) returning * into created_invitation;

  return query select
    created_invitation.id,
    invite_token,
    created_invitation.email,
    created_invitation.expires_at;
end;
$$;

create function public.get_space_invitation(p_raw_token text)
returns table (
  invitation_id uuid,
  space_id uuid,
  space_name text,
  inviter_name text,
  invited_email text,
  expires_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_email text;
begin
  if caller_id is null then
    raise exception 'Sign in to view this invitation.' using errcode = '42501';
  end if;
  if p_raw_token is null or length(p_raw_token) < 32 or length(p_raw_token) > 256 then
    raise exception 'This invitation link is invalid.' using errcode = '22023';
  end if;

  select lower(account.email) into caller_email
  from auth.users account where account.id = caller_id;

  return query
  select
    invitation.id,
    invitation.space_id,
    space.name,
    coalesce(inviter.display_name, 'Your adventure partner'),
    invitation.email,
    invitation.expires_at,
    case
      when invitation.accepted_at is not null then 'accepted'
      when invitation.revoked_at is not null then 'revoked'
      when invitation.expires_at <= now() then 'expired'
      else 'pending'
    end
  from public.space_invitations invitation
  join public.spaces space on space.id = invitation.space_id
  join public.profiles inviter on inviter.id = invitation.invited_by
  where invitation.token_hash = encode(extensions.digest(p_raw_token, 'sha256'), 'hex')
    and invitation.email = caller_email;
end;
$$;

create function public.accept_space_invitation(p_raw_token text)
returns table (id uuid, name text, created_by uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_email text;
  invitation public.space_invitations%rowtype;
begin
  if caller_id is null then
    raise exception 'Sign in to accept this invitation.' using errcode = '42501';
  end if;
  if p_raw_token is null or length(p_raw_token) < 32 or length(p_raw_token) > 256 then
    raise exception 'This invitation link is invalid.' using errcode = '22023';
  end if;

  select lower(account.email) into caller_email
  from auth.users account where account.id = caller_id;

  select * into invitation
  from public.space_invitations candidate
  where candidate.token_hash = encode(extensions.digest(p_raw_token, 'sha256'), 'hex')
  for update;

  if invitation.id is null or invitation.email <> caller_email then
    raise exception 'This invitation is not available for this account.' using errcode = '42501';
  end if;
  if invitation.accepted_at is not null then
    raise exception 'This invitation has already been used.' using errcode = '23505';
  end if;
  if invitation.revoked_at is not null then
    raise exception 'This invitation has been revoked.' using errcode = '22023';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'This invitation has expired.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.space_members member
    where member.space_id = invitation.space_id and member.user_id = caller_id
  ) then
    raise exception 'You are already a member of this space.' using errcode = '23505';
  end if;

  insert into public.space_members(space_id, user_id, role)
  values (invitation.space_id, caller_id, 'member');

  update public.space_invitations
  set accepted_by = caller_id, accepted_at = now()
  where space_invitations.id = invitation.id;

  return query
  select space.id, space.name, space.created_by
  from public.spaces space where space.id = invitation.space_id;
end;
$$;

create function public.revoke_space_invitation(
  p_space_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not (select private.is_space_owner(p_space_id)) then
    raise exception 'Only the space owner can revoke invitations.' using errcode = '42501';
  end if;

  update public.space_invitations
  set revoked_at = now()
  where id = p_invitation_id
    and space_id = p_space_id
    and accepted_at is null
    and revoked_at is null;

  if not found then
    raise exception 'This pending invitation could not be revoked.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.remove_space_member(
  p_space_id uuid,
  p_member_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_role text;
  owner_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not (select private.is_space_owner(p_space_id)) then
    raise exception 'Only the space owner can remove members.' using errcode = '42501';
  end if;
  if p_member_user_id = caller_id then
    raise exception 'You cannot remove yourself from the space you own.' using errcode = '42501';
  end if;

  select member.role into target_role
  from public.space_members member
  where member.space_id = p_space_id and member.user_id = p_member_user_id
  for update;

  if target_role is null then
    raise exception 'This member does not belong to the space.' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    select count(*) into owner_count from public.space_members member
    where member.space_id = p_space_id and member.role = 'owner';
    if owner_count <= 1 then
      raise exception 'Every shared space must keep an owner.' using errcode = '23514';
    end if;
    raise exception 'Owner removal is not supported yet.' using errcode = '42501';
  end if;

  delete from public.space_members
  where space_id = p_space_id and user_id = p_member_user_id;
end;
$$;

create function public.list_space_members(p_space_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    member.user_id,
    profile.display_name,
    account.email,
    member.role,
    member.created_at
  from public.space_members member
  join public.profiles profile on profile.id = member.user_id
  join auth.users account on account.id = member.user_id
  where member.space_id = p_space_id
    and (select private.is_space_member(p_space_id))
  order by case member.role when 'owner' then 0 else 1 end, member.created_at;
$$;

revoke execute on function public.create_space_invitation(uuid, text) from public, anon;
revoke execute on function public.get_space_invitation(text) from public, anon;
revoke execute on function public.accept_space_invitation(text) from public, anon;
revoke execute on function public.revoke_space_invitation(uuid, uuid) from public, anon;
revoke execute on function public.remove_space_member(uuid, uuid) from public, anon;
revoke execute on function public.list_space_members(uuid) from public, anon;

grant execute on function public.create_space_invitation(uuid, text) to authenticated, service_role;
grant execute on function public.get_space_invitation(text) to authenticated, service_role;
grant execute on function public.accept_space_invitation(text) to authenticated, service_role;
grant execute on function public.revoke_space_invitation(uuid, uuid) to authenticated, service_role;
grant execute on function public.remove_space_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_space_members(uuid) to authenticated, service_role;
