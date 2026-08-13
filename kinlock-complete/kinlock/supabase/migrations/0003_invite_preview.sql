-- Lets an invite link show "You've been invited to join The Wylies as an
-- Editor" to someone who isn't a family member yet (and may not even have
-- an account yet) — without opening up broad SELECT access on invites.
create function public.get_invite_preview(invite_token uuid)
returns table (
  family_name text,
  role family_role,
  invited_email text,
  is_expired boolean,
  is_used boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    f.name,
    i.role,
    i.email,
    i.expires_at < now(),
    i.accepted_at is not null
  from public.invites i
  join public.families f on f.id = i.family_id
  where i.token = invite_token;
$$;

grant execute on function public.get_invite_preview(uuid) to anon, authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.create_family_with_admin(text) to authenticated;
