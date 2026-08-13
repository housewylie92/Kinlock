-- Kinlock: Phase 3 schema — Google Calendar two-way sync
--
-- Design choice: each family member can connect their OWN Google account.
-- Rather than syncing into their primary calendar (noisy, mixes personal
-- and family events, and users would have to manage visibility), Kinlock
-- creates a dedicated secondary calendar in their Google account —
-- "Kinlock — {family name}" — and syncs only within that calendar.
-- That keeps the sync surface bounded and makes incremental sync
-- (Google's syncToken mechanism) tractable: everything in that calendar
-- is Kinlock's business, full stop.

-- ─────────────────────────────────────────────────────────────
-- 1. Calendar connections — one per (user, family)
-- ─────────────────────────────────────────────────────────────
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,

  -- OAuth tokens. NOTE: stored as plaintext for MVP simplicity — before
  -- inviting real families, wrap these in Supabase Vault (or app-level
  -- envelope encryption) rather than storing raw tokens in a normal
  -- column. RLS below at least scopes read access to the owning user.
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,

  google_calendar_id text not null, -- the dedicated "Kinlock — Family" calendar
  sync_token text, -- Google's incremental-sync cursor; null until first full sync
  last_synced_at timestamptz,

  created_at timestamptz not null default now(),
  unique (user_id, family_id)
);

alter table public.calendar_connections enable row level security;

create policy "calendar_connections_owner_only"
  on public.calendar_connections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. Event ↔ Google event links
--    One Kinlock event can map to a different Google event ID in each
--    connected family member's calendar, so this can't be a single
--    column on `events` — it has to be its own table.
-- ─────────────────────────────────────────────────────────────
create table public.event_google_links (
  event_id uuid not null references public.events (id) on delete cascade,
  connection_id uuid not null references public.calendar_connections (id) on delete cascade,
  google_event_id text not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, connection_id)
);

create index event_google_links_connection_idx
  on public.event_google_links (connection_id, google_event_id);

alter table public.event_google_links enable row level security;

create policy "event_google_links_family_member"
  on public.event_google_links for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_google_links.event_id
        and public.get_family_role(e.family_id) is not null
    )
  );

-- Writes to this table only ever happen from server-side sync code using
-- the service role key (see src/lib/google/sync.ts), which bypasses RLS
-- by design — family members never write these rows directly.
