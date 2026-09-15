# Urugendo — Project Conventions for AI Coding Assistant

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Supabase (auth, database, RLS policies)
- Framer Motion for animation, vaul for drawers, lucide-react for icons
- Brand: primary green #00B85C, accent amber #F59E0B, font Plus Jakarta Sans

## Hard rules — follow these on every change
1. **Never rewrite a whole file** if only part of it needs to change. Make the
   smallest possible diff that fixes the issue.
2. **Never touch code that is already working**, even if it looks messy,
   unless the task explicitly asks you to refactor it.
3. **Never invent files, functions, or variable names that don't exist** in
   this repo. If you're unsure whether something exists, ask instead of
   guessing.
4. When a function or variable is used in more than one file, **use the exact
   same name and signature everywhere** — check how it's already named in the
   other file before writing new code that references it.
5. All data must come from real Supabase tables — never fall back to
   hardcoded/mock/seed numbers "just in case" a query returns empty.
6. Every booking, payment, or manifest action must be scoped to the correct
   branch/station and the correct authenticated user. Never let one user's
   session leak into another's data.
7. Respect existing RLS (row-level security) policies — don't disable or
   bypass them to make a bug "go away."
8. After a change, briefly state: (a) which files you touched, (b) what you
   changed in each, and (c) anything you noticed but did NOT fix, so nothing
   gets silently skipped.

## Known trouble spots (don't reintroduce these bugs)
- `profiles` table previously had an infinite-recursion RLS bug.
- Manifest station dropdown must only show the logged-in agent's own branch,
  never a hardcoded list of all stations.
- Group bookings must save one row per seat booked, not one row for the
  whole group.
- Dashboards must never fall back to seed/demo numbers when a table is empty
  — show a real empty state instead.

## Style
- TypeScript strict typing — no `any` unless unavoidable, and say why if used.
- Keep components small and colocate related logic; follow existing folder
  structure rather than introducing a new pattern.
- Match existing Tailwind class ordering/conventions already used in the repo.
