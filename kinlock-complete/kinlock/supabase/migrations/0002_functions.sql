-- Kinlock: Phase 1 functions
-- These wrap multi-table writes (create family + add admin, accept invite +
-- join family) in single atomic operations, and run as SECURITY DEFINER so
-- they can validate an invite token and insert a membership row that RLS
-- would otherwise block a brand-new member from creating themselves.

-- ─────────────────────────────────────────────────────────────
-- Create a family and make the creator its admin, atomically.
-- ─────────────────────────────────────────────────────────────
create function public.create_family_with_admin(family_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family public.families;
begin
  insert into public.families (name, created_by)
  values (family_name, auth.uid())
  returning * into new_family;

  insert into public.family_members (family_id, user_id, role)
  values (new_family.id, auth.uid(), 'admin');

  return new_family;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Accept an invite by token: validates it hasn't expired or already
-- been used, then adds the current user to the family with the
-- role specified on the invite.
-- ─────────────────────────────────────────────────────────────
create function public.accept_invite(invite_token uuid)
returns public.family_members
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_invite public.invites;
  new_membership public.family_members;
begin
  select * into matched_invite
  from public.invites
  where token = invite_token
  for update;

  if matched_invite is null then
    raise exception 'This invite link is invalid.';
  end if;

  if matched_invite.accepted_at is not null then
    raise exception 'This invite has already been used.';
  end if;

  if matched_invite.expires_at < now() then
    raise exception 'This invite link has expired. Ask an admin to send a new one.';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (matched_invite.family_id, auth.uid(), matched_invite.role)
  on conflict (family_id, user_id) do update set role = excluded.role
  returning * into new_membership;

  update public.invites
  set accepted_at = now()
  where id = matched_invite.id;

  return new_membership;
end;
$$;
