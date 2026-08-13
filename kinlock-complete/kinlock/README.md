# Kinlock

The family calendar that actually stays in sync. Two-way Google Calendar sync, real database-enforced permissions, and AI Quick-Add for parsing messy scheduling text — the fixes for the three things that made Cozi's users leave.

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind v4)
- **Supabase** — Postgres + Auth + Row Level Security
- **Vercel** — hosting (same pipeline as Family Command Center)

## What's built

**Phase 1 — Foundation**
- Email/password auth (sign up, sign in, sign out)
- Family creation — the creator automatically becomes Admin
- Role-based permissions **enforced at the database level** via Postgres RLS, not just hidden in the UI — a Viewer account physically cannot write to the `events` table, full stop
- Invite flow — generate a shareable link, invited person signs up/signs in, accepts, and joins with the assigned role

**Phase 2 — Calendar**
- Month and week views, color-coded per family member
- Create, edit, and delete events (title, date/time or all-day, assignee, location, notes) — Viewers see a read-only version of the same modal, and the API enforces this server-side even if someone bypasses the UI
- "Coming up" panel — a lightweight, in-app view of anything starting in the next 48 hours
- Optional foreground browser reminders (native `Notification` API) for events starting within 15 minutes, while the tab is open

**Phase 3 — Google Calendar two-way sync**
- Each family member can connect their own Google account
- Kinlock creates a dedicated secondary calendar in their Google account — **"Kinlock — {Family Name}"** — rather than syncing into their primary calendar. This keeps family events from mixing into personal/work events, and keeps sync scoped to something Kinlock fully owns
- **App → Google**: creating, editing, or deleting an event in Kinlock immediately pushes to every connected family member's Kinlock calendar in Google
- **Google → App**: editing an event or adding a brand-new one directly inside that Kinlock calendar in Google pulls back into the app on the next sync, and fans out to every other connected member — this is the actual two-way part Cozi never had
- Runs on a schedule (Vercel Cron, every 10 minutes) plus a manual "Sync now" button, using Google's incremental sync tokens rather than a full re-fetch each time
- Deliberately scoped policy: **deleting your own copy in Google only unlinks your mirror** — it doesn't cascade-delete the shared family event. Deleting a family event for everyone stays an explicit, visible action inside the app

**Phase 4 — AI Quick-Add**
- Paste in messy scheduling text — a group text thread, a school email, your own shorthand — and Claude splits it into individual events
- Uses Claude's **structured outputs** feature (`output_config.format`), not prompt-and-hope JSON — the response is schema-validated, so there's no `JSON.parse()` failure mode to handle
- The "who's this for" field is a dynamically-built enum of your actual family roster, so Claude can only assign an event to someone who's really in the family — no fuzzy string matching needed on the way back
- Every parsed event is shown in an editable review screen before anything saves — nothing goes on the calendar without a confirm click. Events where the date/time was ambiguous are flagged "Double-check this one" rather than silently guessing wrong
- Saved events flow through the exact same `/api/events` endpoint as manual ones, so Google sync (Phase 3) picks them up automatically — no separate code path to keep in sync

**Not yet built** — real background push notifications (needs a service worker + push service).

## Local setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is plenty for now).

2. **Run the migrations.** In the Supabase dashboard, go to SQL Editor, and run the files in `supabase/migrations/` **in order**:
   - `0001_init.sql` — tables, enums, and RLS policies
   - `0002_functions.sql` — atomic create-family and accept-invite functions
   - `0003_invite_preview.sql` — lets invite links show family name/role before joining
   - `0004_events_calendar_fields.sql` — adds all-day/location/notes to events, keeps `updated_at` accurate
   - `0005_google_sync.sql` — Google Calendar connections and the event-link table for two-way sync

   (If you install the Supabase CLI later, `supabase db push` does this automatically — for now, copy/paste is simplest.)

3. **Copy your API keys.** In the Supabase dashboard: Settings → API. You need the Project URL, the `anon` public key, and the `service_role` key.

4. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from step 3. (Google and Anthropic keys are covered in their own setup sections below — the app runs fine without them, just without sync or Quick-Add.)

5. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

6. **Turn off email confirmation for faster local testing (optional):** Supabase dashboard → Authentication → Providers → Email → toggle off "Confirm email." Turn it back on before you invite real families.

## Testing the permission model

This is the part worth actually clicking through, since it's the whole point of Phase 1 & 2:

1. Sign up as yourself → create a family → you're the Admin.
2. Use the "Invite someone" box on the dashboard, invite a second email address as **Viewer**.
3. Copy the invite link it gives you, open it in an incognito window, sign up with that second email, and accept.
4. You should now see both accounts on the roster with the correct role badges.
5. As the Admin, open the calendar and add a few events — try assigning one to each family member and toggling all-day.
6. Log in as the Viewer in the incognito window, open the calendar, and confirm: you can see every event, but clicking one opens a read-only modal with no save/delete option, and there's no "+ Add event" button. That's the UI respecting the role.
7. To confirm it's not just the UI being polite: try hitting `POST /api/events` directly as the Viewer (e.g. via curl or your browser's dev tools) — it should fail, because Postgres RLS blocks the insert regardless of what the client sends.

## Setting up Google Calendar sync (Phase 3)

This is the one setup step that takes real clicking-through, since Google requires a project and OAuth credentials per app.

1. **Create a Google Cloud project** at [console.cloud.google.com](https://console.cloud.google.com) (free).

2. **Enable the Calendar API**: APIs & Services → Library → search "Google Calendar API" → Enable.

3. **Configure the OAuth consent screen**: APIs & Services → OAuth consent screen.
   - User type: **External** (unless you have a Google Workspace org)
   - App name: Kinlock, add your email as a test user for now
   - Scopes: add `https://www.googleapis.com/auth/calendar` — this is a "sensitive" scope, which means Google will show an "unverified app" warning during testing. That's expected and fine while you're the only one testing; Google's verification review is only needed before a public launch with real families.
   - Add your own email (and any early testers) under **Test users** — while the app is unverified, only test users you list can actually complete the OAuth flow

4. **Create OAuth credentials**: APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/api/google/callback` for local dev (add your production URL's equivalent later, e.g. `https://your-app.vercel.app/api/google/callback`)
   - Copy the **Client ID** and **Client Secret**

5. **Add to your environment variables** (`.env.local` and later your Vercel project settings):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
   CRON_SECRET=...   # any long random string
   ```

6. **Set `CRON_SECRET` in Vercel too**, once deployed — Vercel automatically sends it as a Bearer token when it triggers the scheduled sync defined in `vercel.json`, so the cron job authenticates itself without you wiring anything else up.

### Testing the sync loop

1. On the calendar page, click **Connect Google Calendar** and complete the consent flow (you'll see the "unverified app" warning — click through it as the test user).
2. Check your Google Calendar — you should see a new secondary calendar called **"Kinlock — {your family name}"**, already populated with any events you'd created in Kinlock.
3. Create an event in Kinlock → it should appear in that Google calendar within a few seconds.
4. Add a new event **directly in that Google calendar** (not in Kinlock) → click "Sync now" on the Kinlock calendar page (or wait up to 10 minutes for the cron job) → it should appear in Kinlock.
5. If you've connected a second family member's account too, confirm changes propagate to their Kinlock calendar in Google as well — that's the actual multi-way sync working, not just a single round trip.

### Known limitations worth knowing about before real families use this

- **Tokens are stored as plaintext** in `calendar_connections` for now. RLS restricts read access to the owning user, but before inviting real families, wrap `access_token`/`refresh_token` in Supabase Vault or application-level encryption rather than a plain column.
- **Sync is poll-based (every 10 min), not instant.** True real-time push needs Google Calendar push notifications, which require a verified public HTTPS endpoint and channel renewal logic — a reasonable Phase 3.5 once the app has stable production hosting.
- **Conflict resolution is "last write wins."** If the same event is edited in Kinlock and in Google within the same ~10-minute window, whichever sync runs last overwrites the other. Fine for a family calendar's actual usage pattern, but worth knowing.

## Setting up AI Quick-Add (Phase 4)

Much lighter than the Google setup — just one key.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com) (Settings → API Keys).
2. Add it to `.env.local` (and later, your Vercel project settings):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. That's it — no migration needed, Quick-Add doesn't add new tables.

**Try it:** on the calendar page, click **✨ AI Quick-Add**, and paste something like:
```
soccer practice Tues 4pm for Emma, dentist Thursday 2:30 for Jake, family dinner Friday 6pm
```
You should get back three separate, correctly-dated events with Emma and Jake matched to their actual roster entries. Try something intentionally vague too (like "sometime next week, maybe Wednesday?") to see the "Double-check this one" flag in action — that's the guardrail against silently mis-guessing a date.

## Deploying

Same flow as Family Command Center: push to GitHub, import into Vercel, add the three environment variables from `.env.local` in the Vercel project settings, deploy. Update `NEXT_PUBLIC_SITE_URL` to your real Vercel URL once it's live, so invite links point to the right place.

## Project structure

```
src/
  app/
    login/, signup/          — auth pages
    onboarding/               — create-a-family flow
    invite/[token]/           — accept-invite flow
    dashboard/                — family roster (Phase 1)
    dashboard/calendar/       — month/week calendar, event CRUD, reminders, Google sync UI (Phase 2 & 3)
    api/families/, api/invites/, api/events/ — route handlers backing the above
    api/google/               — OAuth connect/callback/disconnect
    api/sync/google/          — manual "Sync now"
    api/cron/sync-google/     — scheduled sync for every connection (Vercel Cron)
    api/ai/quick-add/         — parses pasted text into structured events via Claude
  components/
    AuthLayout.tsx             — the split-panel brand layout
    InterlockMark.tsx          — the signature two-arc logo/animation
    form.tsx, RoleBadge.tsx    — shared UI primitives
  lib/
    supabase/                  — browser, server, and service-role Supabase clients
    google/                    — OAuth helpers, Calendar API wrapper, and the push/pull sync logic
    ai/                        — Claude structured-outputs parsing for Quick-Add
    types.ts                   — shared Event/FamilyMember types
  middleware.ts → proxy.ts      — session refresh + page route protection (API routes handle their own auth)
supabase/migrations/            — run these in order in the Supabase SQL editor
vercel.json                     — cron schedule for the Google sync job
```
