# Urugendo Bolt - Change Log

> **Purpose**: This file tracks every significant decision made during development — the WHY, HOW, and CONSEQUENCES. Read this before making any changes to understand the context and reasoning behind each modification.

---

## Session: 2026-09-07 - Database Schema Fix & GitHub Deployment

### Context
The user reported that their Supabase dashboard showed "12 tables" but the codebase only had migrations for 6 core tables. Investigation revealed schema drift between the codebase and live database.

### Database Discovery

After querying `information_schema.tables`, the following tables exist in the public schema:

| Table | Purpose | Status |
|-------|---------|--------|
| `profiles` | User accounts with role-based access | ✅ Active |
| `operators` | Bus companies (Volcano, RITCO, Trinity, Virunga) | ✅ Active |
| `buses` | Individual buses with plate numbers, seats | ✅ Active |
| `trips` | Scheduled departures with routes, pricing | ✅ Active |
| `bookings` | Passenger seat reservations | ✅ Active |
| `payments` | MTN MoMo / Airtel transactions | ✅ Active |
| `branches` | Agency branch stations | ✅ Active |
| `agency_agents` | Station agent registration/approval | ✅ Active |
| `routes` | Pre-defined route catalog | ✅ Active |
| `notifications` | App notification log | ✅ Active |
| `route_durations` | Route timing data | 🔒 Unused |
| `seats` | Seat management | 🔒 Unused |

**Decision**: `route_durations` and `seats` exist in DB but are NOT referenced in the codebase. Per "Unused Tables Policy", these are left untouched. They may be legacy tables or reserved for future features.

---

### Change #1: Supabase API Key Format Update

**File**: `src/lib/supabase.ts`

**Problem**: 
- Code was using OLD JWT format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- User's new project uses NEW `sb_publishable_` format
- Without this fix, app cannot connect to database

**Why this was needed**:
The user migrated to a new Supabase project with a new key format. The old key would return "Invalid API key" errors on all database queries.

**How it was fixed**:
```typescript
// BEFORE
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// AFTER
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_0_K8ivC1kuXNMg2k74Jt9g_KhvZ-71Y";
```

**Environment Variables**:
Created `.env` and `.env.example` with:
- `NEXT_PUBLIC_SUPABASE_URL=https://zrvcqlyowqfrqdidozrk.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_0_K8ivC1kuXNMg2k74Jt9g_KhvZ-71Y`

**Consequences**:
- ✅ App now connects to user's Supabase project
- ⚠️ Old JWT key no longer works (intentional)

---

### Change #2: Fixed `agents` → `agency_agents` Table Reference

**File**: `src/app/agency/page.tsx`

**Problem**: 
Code referenced a table called `agents` which doesn't exist. The actual table is `agency_agents`.

**Discovery**: 
Running `curl` queries against the database revealed:
- `agents` → 404 "table not found"
- `agency_agents` → 200 OK, returned 1 record

**Why this happened**:
During development, someone created a table named `agency_agents` but a query somewhere was written as `agents` (singular). This is a naming inconsistency bug.

**How it was fixed**:
```typescript
// BEFORE (line 151)
.from("agents")

// AFTER
.from("agency_agents")
```

Also updated the realtime subscription:
```typescript
// BEFORE
table: "agents",

// AFTER  
table: "agency_agents",
```

**Impact**:
- Agency dashboard can now read agent approval status
- Realtime updates for agent approval will work
- Manager portal can approve agents

---

### Change #3: Created Missing Migration File

**File**: `supabase/migrations/20260907120001_create_missing_tables.sql`

**Problem**:
4 tables existed in the live database but had no corresponding migration file:
1. `branches` - Agency branch stations
2. `agency_agents` - Agent registration/approval
3. `routes` - Route catalog
4. `notifications` - App notifications

**Why this matters**:
Without migrations, new developers can't recreate the schema. The codebase and database were out of sync.

**What's included**:

#### A. New Tables (with RLS policies)
```sql
-- branches
CREATE TABLE public.branches (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  location text,
  momo_code text,
  phone text,
  agent_name text,
  agent_email text,
  stats jsonb,
  created_at timestamptz
);

-- agency_agents  
CREATE TABLE public.agency_agents (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  branch_name text NOT NULL,
  phone text,
  is_approved boolean DEFAULT false,
  status text CHECK (pending/approved/rejected),
  created_at timestamptz
);

-- routes
CREATE TABLE public.routes (
  id uuid PRIMARY KEY,
  from_city text NOT NULL,
  to_city text NOT NULL,
  distance_km int,
  base_price int,
  duration_minutes int,
  created_at timestamptz
);

-- notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  title text,
  message text,
  type text,
  action_url text,
  read boolean DEFAULT false,
  created_at timestamptz
);
```

#### B. Column Additions to Existing Tables
- `profiles`: email, operator_id, branch, status
- `trips`: date, amenities[], bus_type, plate_number, currency, from, to, origin_branch, destination_branch
- `bookings`: booking_code, fare_amount, momo_number, momo_name, bus_type, agency_branch, empty_seats, agency_id
- `operators`: branches[]

**Security Note**:
All new tables have `TO anon, authenticated USING (true)` policies. This is permissive for the demo phase. When real auth is wired up, these should be tightened.

**Consequences**:
- Schema is now documented in version control
- New developers can run `supabase db reset` to get a clean state
- Future migrations can reference these tables

---

### Change #4: Unused Tables Left Untouched

**Tables Ignored**: `route_durations`, `seats`

**Reason**:
Per the project policy: "If tables exist in Supabase but are never referenced or imported anywhere in the application code, leave them alone."

These tables exist but no code queries them. Possible explanations:
- Legacy tables from an earlier version
- Reserved for future features
- Generated by a Supabase template

**Decision**: Do NOT modify or create migrations for these tables.

---

### Files Modified Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/supabase.ts` | Modified | Updated API key format |
| `src/app/agency/page.tsx` | Modified | Fixed agents → agency_agents |
| `supabase/migrations/20260907120001_create_missing_tables.sql` | Created | Document missing tables |
| `.env` | Created | Local environment (gitignored) |
| `.env.example` | Created | Template for other devs |
| `changelog.md` | Created | This file |

---

### Verification Checklist

- [x] Supabase URL correct: `https://zrvcqlyowqfrqdidozrk.supabase.co`
- [x] Publishable key format: `sb_publishable_0_...`
- [x] No remaining `from("agents")` references
- [x] All code-referenced tables exist in DB
- [x] Unused tables identified but not touched
- [x] Migration file created
- [x] .gitignore excludes .env files

---

## Previous Sessions

*[To be updated as sessions progress]*

---

**Last Updated**: 2026-09-07
**Updated By**: Claude (AI Assistant)
