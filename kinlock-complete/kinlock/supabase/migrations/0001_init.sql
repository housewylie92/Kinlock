-- Kinlock: Phase 1 schema
-- Families, members, roles, invites, and the row-level security that
-- enforces Admin / Editor / Viewer permissions at the database layer
-- (not just in the UI — this is what Cozi never had).

-- ─────────────────────────────────────────────────────────────
-- 1. Extensions
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 2. Enums
-- ─────────────────────────────────────────────────────────────
create type family_role as enum ('admin', 'editor', 'viewer');

-- ─────────────────────────────────────────────────────────────
-- 3. Profiles (extends Supabase auth.users)
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#2B3A67',
  is_kid_account boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'New member'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 4. Families
-- ─────────────────────────────────────────────────────────────
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. Family members (the permission table)
-- ─────────────────────────────────────────────────────────────
create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role family_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Helper function so RLS policies can check "is this user in this family,
-- and with what role" WITHOUT the policy querying family_members from
-- inside a family_members policy (which causes infinite recursion in
-- Postgres RLS — a common Supabase gotcha).
create function public.get_family_role(target_family_id uuid)
returns family_role
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.family_members
  where family_id = target_family_id
    and user_id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Invites
-- ─────────────────────────────────────────────────────────────
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null,
  role family_role not null default 'editor',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

create unique index invites_token_idx on public.invites (token);

-- ─────────────────────────────────────────────────────────────
-- 7. Events (minimal stub for Phase 1 — full calendar UI is Phase 2,
--    but the permission model needs a real table to enforce against)
-- ─────────────────────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  assigned_to uuid references public.profiles (id),
  source text not null default 'manual', -- 'manual' | 'ai_quick_add' | 'google_sync'
  google_event_id text, -- populated once two-way sync (Phase 3) writes back
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_family_starts_idx on public.events (family_id, starts_at);

-- ─────────────────────────────────────────────────────────────
-- 8. Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invites enable row level security;
alter table public.events enable row level security;

-- Profiles: anyone can read profiles of people in a family with them;
-- only the owner can update their own profile.
create policy "profiles_select_own_or_family"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.family_members fm1
      join public.family_members fm2 on fm1.family_id = fm2.family_id
      where fm1.user_id = auth.uid() and fm2.user_id = profiles.id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

-- Families: members can read; only admins can update/delete.
create policy "families_select_member"
  on public.families for select
  using (public.get_family_role(id) is not null);

create policy "families_insert_any_authenticated_user"
  on public.families for insert
  with check (created_by = auth.uid());

create policy "families_update_admin_only"
  on public.families for update
  using (public.get_family_role(id) = 'admin');

create policy "families_delete_admin_only"
  on public.families for delete
  using (public.get_family_role(id) = 'admin');

-- Family members: members can see the roster; only admins can change roles
-- or remove people. Anyone can insert themselves when accepting an invite
-- (enforced at the application layer via the invite token, not here).
create policy "family_members_select_same_family"
  on public.family_members for select
  using (public.get_family_role(family_id) is not null);

create policy "family_members_admin_manage"
  on public.family_members for update
  using (public.get_family_role(family_id) = 'admin');

create policy "family_members_admin_delete"
  on public.family_members for delete
  using (public.get_family_role(family_id) = 'admin');

create policy "family_members_self_insert"
  on public.family_members for insert
  with check (user_id = auth.uid());

-- Invites: admins and editors can create/view invites for their family.
create policy "invites_select_family"
  on public.invites for select
  using (public.get_family_role(family_id) in ('admin', 'editor'));

create policy "invites_insert_family"
  on public.invites for insert
  with check (public.get_family_role(family_id) in ('admin', 'editor'));

create policy "invites_delete_admin"
  on public.invites for delete
  using (public.get_family_role(family_id) = 'admin');

-- Events: viewers can read, editors+admins can write. This is the
-- concrete enforcement of the role model — a kid-account viewer
-- physically cannot delete an event at the database level, unlike Cozi.
create policy "events_select_family"
  on public.events for select
  using (public.get_family_role(family_id) is not null);

create policy "events_insert_editor_or_admin"
  on public.events for insert
  with check (public.get_family_role(family_id) in ('admin', 'editor'));

create policy "events_update_editor_or_admin"
  on public.events for update
  using (public.get_family_role(family_id) in ('admin', 'editor'));

create policy "events_delete_editor_or_admin"
  on public.events for delete
  using (public.get_family_role(family_id) in ('admin', 'editor'));
