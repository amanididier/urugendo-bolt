# Urugendo — Production Readiness Fix Plan
**Prepared 5 Sept 2026 · For: Amani (Founder, Urugendo)**

This is a full plan to take Urugendo from "demo with mock data" to something you can put in front of Virunga's boss without fear. It's ordered by **risk**, not by how the bugs happened to show up in your notes — because with only 5 Lovable credits/day, you need to spend them on the things that could actually sink the pilot first.

---

## 0. Two quick things, before any code

**Your GitHub sync problem — yes, it's the private repo.**
When you flipped `urugendo` to private, Lovable's GitHub App can lose the specific permission grant for that repo, so its two-way sync starts returning "not found." Fix:
1. In Lovable → Project Settings → GitHub, disconnect and reconnect the integration (this re-triggers the GitHub OAuth/App authorization flow, which will now ask for access to the now-private repo).
2. If that doesn't prompt correctly, go to GitHub → Settings → Applications → Installed GitHub Apps → find the Lovable app → "Configure" → make sure `urugendo` is checked under repository access.
3. As a last resort, briefly flip the repo back to public, let Lovable resync once, then set it private again.
Either way — Lovable's *own internal copy* of your code is intact and safe; nothing was lost. This is purely a permissions/sync issue.

**Testing your 3 account types (user / agent / manager).**
Yes — use separate browser profiles or incognito/private windows, one per role, rather than relying on one browser's local storage. This isn't just a workaround for you as a tester — it's evidence of the real bug in Batch 1 below (the app is currently using local storage as if it were your identity, which is exactly what's leaking data between real users too). Once Batch 1 ships, this stops being necessary for testing, but use it in the meantime so you don't confuse "my test setup" bugs with real bugs.

---

## Risk tiers at a glance

| Tier | What's at stake | Batches |
|---|---|---|
| **P0 — Trust-breaking** | A real user could see another user's data, or the agency's numbers are provably fake | 1, 2, 3 |
| **P1 — Functionally broken** | Features exist but don't do the real job yet | 4, 5 |
| **P2 — Polish / scale** | Visible rough edges, and readiness for many simultaneous users | 6, 7 |

Do them **in order**. Don't let anyone see the app for the pilot until at least P0 (Batches 1–3) is done — a fast app with fake revenue numbers is worse for trust than a slow one with real numbers.

---

## Batch 1 — Real identity, no data leakage (P0, do this first)

**Why first:** this is the one that could actually destroy trust — a passenger seeing another passenger's name, ticket, or personal details is the kind of bug that gets an app banned from a business relationship, not just patched.

**Root cause (per your own investigation + confirmed by Gemini's read of the code):** bookings are written to Supabase without a real `user_id` attached, "My Tickets" queries fetch *all* bookings instead of filtering by the logged-in user, and role/identity ("I'm an agent") is being remembered in local storage instead of through a real authenticated session — which is also why your agent login bled into your user account.

**Copy-paste prompt for Lovable:**
> Before changing anything, read through the authentication flow, the booking-creation code (checkout/payment confirmation), and the "My Tickets" / upcoming-tickets page, and tell me back in plain language how identity currently flows through the app. Then fix these two things only, without touching unrelated files or components:
> 1. Every booking insert must attach `user_id` from `supabase.auth.getUser()` — never insert a booking without a real authenticated user attached. If there is no authenticated user, block the booking and prompt sign-in instead of silently allowing it.
> 2. Every screen that lists "my tickets," "my bookings," or "others I've booked for" must filter strictly by that user's own `user_id` (or bookings they personally created), never by fetching all rows. Also remove any local-storage-based role or identity flag that persists after logout or across accounts — role/identity must come only from the authenticated Supabase session, refreshed on every login.
> Also add Supabase Row Level Security policies on the `bookings` table so this is enforced at the database level too, not just in the frontend query — a user should not be able to `SELECT` another user's bookings even if they inspect network requests.
> Log every file you touch and why into `CHANGELOG.md` (create it if it doesn't exist) before finishing.

**Also in this batch — one more identity bug from your notes:** new agents can sign in before a manager approves them. Add to the same prompt:
> Additionally: agent sign-in must check an `approved` (boolean) flag on the agent's profile. If `approved` is false, block sign-in with a clear "pending manager approval" message, even if their credentials are otherwise correct.

---

## Batch 2 — Real money, real branch isolation (P0)

**Why second:** your entire pitch to the boss is "prove financial gains in one sentence." If the revenue cards are mock, that pitch is a lie the moment he opens the agent dashboard. And if branches aren't actually isolated, an agent could accidentally (or someone could deliberately) verify or cash out a ticket that isn't theirs to handle.

**Root cause:** there's no `branches` / `agents` table yet, so revenue can't be attributed to a specific branch — it's either hardcoded or summed across everything. The "Musanze agent sees Kigali's scheduled bus as if they scheduled it" bug is the same missing structure.

**Copy-paste prompt for Lovable:**
> Read the current schema and the revenue-card / schedule / manifest / verify-payment code across the agent and manager areas, and tell me back how branch data currently flows (or doesn't). Then implement, without touching unrelated code:
> 1. New tables: `branches` (id, operator/agency id, name, location, momo_code) and `agents` (id, user_id, branch_id, full_name, email, approved). Migrate/attach `branch_id` to `bookings` and `trips` — every trip belongs to the branch that scheduled it, every booking inherits the branch of its trip.
> 2. Row Level Security so an agent can only `SELECT`/`UPDATE` trips, manifests, and bookings where `branch_id` matches their own `agents.branch_id`. An agent must never see another branch's scheduled trip in their own schedule/manifest view as if it were theirs.
> 3. The one narrow exception: if Branch A schedules a trip terminating in Branch B's city, Branch B should see a **read-only "incoming bus" card** (route, ETA) — nothing more, and they still cannot verify or board tickets for that trip.
> 4. Rewrite every revenue stat card (agent dashboard and manager dashboard) to aggregate real `payment_status = 'paid'` bookings filtered by `branch_id`, with real day/month/year filtering that persists — not a live recalculation that resets. If a branch has recorded zero paid bookings today, its "today" card must show 0, not a placeholder number.
> Log every changed file and the reasoning to `CHANGELOG.md`.

---

## Batch 3 — Stop showing fake trips and let people over-book seats (P0)

**Why this is still P0, not P1:** "live departures" showing mock trips isn't cosmetic — it can make someone pay for a bus that doesn't exist. That's a refund/trust incident waiting to happen, arguably worse than a UI bug.

**Copy-paste prompt for Lovable:**
> Remove all mock/placeholder trip data from the live departures / home screen — it must only ever query real scheduled trips from the database for the relevant time window, and show an honest empty state ("no departures right now") when there are none. Do not backfill with sample data under any condition.
> Second, fix seat selection: the seat-selection screen must read the actual group size the user searched with (the same number shown as "n/1 selected" etc.) and hard-cap selectable seats at that number — a user searching for 1 person must never be able to select more than 1 seat, and the cap must scale correctly for any group size.
> Third, on the generated/waiting ticket, the branch contact number shown must be pulled from the real `branches` record tied to that trip's branch — not a hardcoded or mock contact.
> Log changes to `CHANGELOG.md`.

---

## Batch 4 — Real notifications everywhere (P1)

**Why after the P0s:** notifications matter a lot for trust and operations (delay alerts, payment nudges), but a missing notification doesn't leak data or fake money — it's a real gap, not a landmine.

**Copy-paste prompt for Lovable:**
> Read the current notification system across passenger, agent, and manager apps — you'll find it's largely mock/seeded data. Delete the mock notification records and seed logic entirely. Then wire these as real, event-triggered notifications (Supabase database triggers or edge functions, whichever fits the existing architecture better — tell me which you're using and why):
> 1. Passenger gets a real notification the moment their ticket is confirmed/paid.
> 2. Passenger gets a real notification if an agent marks their trip delayed, including the reason the agent submitted.
> 3. The agent who submitted a delay gets a confirmation notification that the passenger alert was sent.
> 4. Any agent with unverified pending MoMo payments gets a reminder notification every 5 minutes for as long as payments remain unverified in their branch's verify tab.
> 5. The manager gets a real-time toast/notification the moment a new agent signs up pending approval (not just an entry in an unread list).
> Where the app is installed as a PWA, use the browser Notification API + existing service worker to deliver these as real native-style push/toast notifications, the same way it already works when installed in Chrome.
> Log changes to `CHANGELOG.md`.

---

## Batch 5 — Build the actual manager app (P1/P2)

**Why now, not first:** you asked for this to be real, but there is currently *no manager role at all* in the live app — this is new construction, not a bug fix, so it should happen after the P0 integrity issues are solved (otherwise you'd be building a manager dashboard on top of fake branch data).

**Copy-paste prompt for Lovable:**
> Build a manager role and its own protected dashboard route, separate from passenger/agent/driver. Requirements:
> 1. Login form: an "Agency" field that loads from a new `agencies` table via dropdown (render as a real dropdown component even though only one row — Virunga — exists today; this must scale to multiple agencies without further UI work).
> 2. Seed one manager record: name "Amani Ishimwe Didier", email "ishimweamanid@gmail.com", manager code `MGR-001`, master password `654321` (store the password hashed, never plaintext, and let me know how you're storing it).
> 3. Manager dashboard must read real branch revenue roll-ups from the `branches`/`bookings` structure built in Batch 2 — total across all of Virunga's branches, filterable by day/month/year, with zero states where appropriate.
> 4. A real-time toast (not just a static list) when a new agent signs up pending approval, and an approve/reject action that flips the agent's `approved` flag — an agent must not be able to sign in until this flag is true (this connects to the Batch 1 fix).
> 5. A "create branch" form for managers that writes a real row to `branches` with name, location, and MoMo code — no mock branches allowed to exist in the data.
> Log changes to `CHANGELOG.md`.

---

## Batch 6 — Visual bug: the phone frame is rendering on real phones (P2, but fix before any demo)

**Root cause:** the iPhone-frame wrapper you added for desktop testing is being rendered unconditionally, so on a real phone it pushes content under the camera notch and hides the bottom nav below the fold.

**Copy-paste prompt for Lovable:**
> First, check the current logic that decides whether to render the phone-frame wrapper (search for the component that wraps the app in the iPhone 15 Pro frame). Only take action if the current check is missing or wrong — do not rebuild it if it's already conditionally correct. It should render **only** on desktop/wide viewports for demo purposes (e.g. `window.matchMedia('(pointer: coarse)')` or a real mobile user-agent/viewport-width check), and never wrap the app when it's genuinely running on a phone or as an installed PWA. Confirm separately that the agency's own bottom navigation never overlaps or replaces the passenger's bottom nav — check the current z-index/layout logic first, and only change it if there's an actual conflict.

---

## Batch 7 — Speed and scale for real concurrent users (P2, do last)

This is the one Gemini/your friend flagged (slow navigation) plus what you'll need for "thousands of users simultaneously."

**Copy-paste prompt for Lovable:**
> Without changing any business logic, improve navigation performance and prepare for concurrent load:
> 1. Add a top-of-page progress bar on route transitions.
> 2. Add route-based code splitting (`React.lazy` + `Suspense`) so each major route (home, seat selection, payment, tickets, agent dashboard, manager dashboard) loads independently instead of one large bundle.
> 3. Introduce data caching for repeated reads (e.g. TanStack Query) so trip/branch lookups aren't re-fetched on every navigation within a session.
> 4. Add database indexes on `trips.branch_id`, `bookings.user_id`, `bookings.branch_id`, and `bookings.trip_id` in Supabase, since these are now the most frequent filter columns after Batches 1–3.
> 5. Tell me if Supabase connection pooling (PgBouncer, already available on your project) is enabled — if not, enable it, since many simultaneous verify/booking actions will otherwise exhaust direct connections.
> Log changes to `CHANGELOG.md`.

---

## Standing instructions for every prompt (put this in your project's AGENTS.md / Lovable project instructions once, so you don't have to repeat it)

> Before making any change, read `CHANGELOG.md` in full so you understand what has already been fixed and why, and do not undo or re-break anything listed there. For every task: only modify the specific files/lines needed for that task — never refactor, rename, or "clean up" unrelated code, even if it looks improvable. After finishing, append a new entry to `CHANGELOG.md` with: date, files changed, what changed, why, and how. Keep inline comments minimal — prefer clear code and the changelog over comments, since comments tend to go stale and mislead future changes.

This single addition is what protects your 5-credits-a-day budget — it stops Lovable from quietly re-touching something Batch 1 already fixed while working on Batch 4.

---

## Suggested pace given 5 credits/day

Each batch above is written as roughly one focused Lovable session. Realistically: Batch 1 and 2 may each take more than one credit since they touch schema + RLS + frontend — budget 2 credits for each of those, 1 credit for Batches 3, 4, 6, and 2 for Batches 5 and 7. That's about 10 credits, or two days, for P0+P1, and a third day for polish/scale — a tight but realistic timeline before you go back to the manager.
