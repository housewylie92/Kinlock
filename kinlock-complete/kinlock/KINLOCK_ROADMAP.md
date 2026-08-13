# Kinlock — Feature Spec & Build Roadmap

**The family calendar that actually stays in sync — and stays free.**

Positioned as the trustworthy, AI-powered alternative to Cozi. Built to directly fix the three things driving Cozi's 2.1★ Trustpilot backlash: fake one-way sync, zero permission controls, and a retroactive paywall that broke 20+ million users' trust.

---

## 1. Positioning & Differentiators

| Cozi's failure | Kinlock's fix |
|---|---|
| One-way sync to Google Calendar only | **True two-way sync** — changes in Google Calendar reflect back in Kinlock automatically |
| Any family member can delete any event, no roles | **Role-based permissions** — Admin / Editor / Viewer (kid-safe view mode) |
| Retroactive 30-day paywall broke long-time users' trust | **Honest free tier, permanently** — core features never get locked behind a surprise paywall |
| Static, manual-entry-only calendar | **AI Quick-Add** — paste or speak messy scheduling info, AI parses it into clean calendar events (built on the same Claude API engine as your Family Logistics Command Center) |

**Product principle to hold onto as you build:** never retroactively restrict something a free user already had. This is the single biggest lever against Cozi — make it a rule you don't break later for revenue pressure.

---

## 2. Target User

Parents already frustrated with Cozi (actively searching for alternatives right now per the 2026 backlash) — particularly households juggling multiple kids' schedules across school, sports, and appointments who want less manual data entry, not more.

---

## 3. MVP Feature Set (v1 — Launch)

**Must-ship:**
- Account creation + family group creation (invite via link/email)
- Role-based permissions: Admin, Editor, Viewer/Kid
- Shared calendar — week/month view, color-coded per family member
- **Two-way Google Calendar sync** (the core wedge — budget the most build time here)
- **AI Quick-Add** — natural language / pasted text → parsed calendar events with a confirmation step before saving (reuses your existing Claude API logic)
- Shared shopping/task list (lightweight — one list, not a project management tool)
- Push notifications / reminders
- Free tier = full feature set above, no event caps, no retroactive lockouts

**v1.5 — fast follow:**
- Apple Calendar / iCloud two-way sync
- Recurring events + smart conflict detection
- Weekly digest email/text ("here's your week ahead") — direct extension of what Family Command Center already does
- Basic chore assignment/tracking

**v2 — growth & monetization:**
- Multi-calendar aggregation (school/sports team iCal feeds)
- Co-parenting mode (separate households, custody schedule support — an underserved niche worth its own positioning)
- Optional, privacy-first location sharing
- Premium tier ($4–6/mo): unlimited AI parses, multiple family groups, priority support

**Explicitly NOT in v1** (Cozi's bloat, skip until proven demand):
- Meal planning / recipes
- Budget tracking
- In-app family chat (people already text)
- Location tracking/geofencing (privacy/liability complexity, not the core wedge)

---

## 4. Technical Architecture (high-level)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (Next.js), mobile-responsive PWA first | Matches your cert coursework; ship web before native to move fast |
| Backend | Next.js API routes / Node.js | Same stack as Family Command Center — reuse what you know |
| Database + Auth | Supabase (Postgres + Auth + Realtime) | Fastest path for a solo builder — auth, family invite flows, and live sync data come near out-of-the-box |
| Calendar sync | Google Calendar API (OAuth) | **Hardest, highest-risk piece — this is what Cozi got wrong, so it's worth the extra time** |
| AI parsing | Anthropic API (Claude) | You already have this working in Family Command Center |
| Hosting | Vercel | Consistent with your existing deployment pipeline |

---

## 5. Build Roadmap

*Estimates assume part-time solo building (~10–15 hrs/week) around your GM schedule — adjust as needed.*

**Phase 1 — Foundation (Weeks 1–2)**
Repo setup, Supabase scaffold, auth, family group creation + invite flow, role-based permission data model.

**Phase 2 — Core Calendar (Weeks 3–4)**
Shared calendar UI (week/month, color-coded), manual event CRUD, basic notifications.

**Phase 3 — The Wedge: Two-Way Sync (Weeks 5–6)**
Google Calendar OAuth integration, two-way sync logic, conflict resolution. This is where Cozi actually failed users — don't rush it.

**Phase 4 — AI Quick-Add (Weeks 7–8)**
Wire in Claude API for parsing messy text/voice into structured events, with a confirmation UI before anything saves. Adapt logic from Family Command Center rather than building from scratch.

**Phase 5 — Polish + Soft Launch (Weeks 9–10)**
Shopping/task list, onboarding flow, soft launch to 10–20 real families — friends, local network, and the Reddit/Facebook groups already flagged as venting about Cozi. Collect feedback before going wider.

**Phase 6 — Public Launch (Week 11+)**
Public launch to the Cozi-backlash audience, monitor sync reliability closely (this is the metric that will make or break trust), begin shaping the premium tier from real usage data.

---

## 6. Success Metrics for MVP

- **Sync reliability** (target >99% — this is the entire differentiator, treat it as sacred)
- Weekly active family groups
- AI Quick-Add usage rate (validates whether the AI wedge is actually the draw, or just the sync fix)

---

## 7. Open Decisions for Later

- Merge with or sunset the existing Family Command Center, or run them as two products sharing the same AI backend?
- Native app timeline (post-PWA validation)
- Co-parenting mode as its own separate positioning/pricing tier

