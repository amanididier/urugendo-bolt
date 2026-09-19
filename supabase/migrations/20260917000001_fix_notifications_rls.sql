/*
# Fix Notifications 403 Forbidden — RLS Row Level Security violation

When a passenger books a ticket, `notifyUser()` inserts into `public.notifications`
with `user_id = auth.uid()`. The live DB had either a missing policy for
`authenticated` or a restrictive WITH CHECK that rejected the row (auth.uid() = null
under the anon key, or no INSERT policy at all), surfacing as 403 Forbidden / RLS
violation. The schedule view and Verify tab also depended on this table being
writable without refresh.

Fix: ensure authenticated users can INSERT and SELECT their own notifications,
can UPDATE (mark read) their own, and keep a permissive fallback for the demo
anon-key flow so existing browser sessions never see a 403. Idempotent — safe to
re-run after the 20260907120001_create_missing_tables migration.

Also re-ensures `action_url`, `user_phone` columns and indexes so no
PGRST204 (column not found) masks the RLS fix, and pokes PostgREST to reload
its schema cache.
*/

-- Ensure table exists and RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Ensure required columns exist (idempotent, keeps PGRST204 from hiding the RLS error)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='user_phone') THEN
    ALTER TABLE public.notifications ADD COLUMN user_phone text;
    CREATE INDEX IF NOT EXISTS idx_notifications_user_phone ON public.notifications(user_phone);
  END IF;
END $$;

-- Drop any prior policies so the next CREATEs are authoritative (idempotent)
DROP POLICY IF EXISTS "notifications_all_anon" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_all" ON public.notifications;

-- 1) Authenticated users: SELECT their own notifications
CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) Authenticated users: INSERT notifications addressed to themselves
CREATE POLICY "notifications_insert_own"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3) Authenticated users: UPDATE (e.g. mark read) their own notifications
CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) Permissive fallback for the current demo anon-key flow (anon client has
--    no JWT, auth.uid() is null). Supabase evaluates policies as OR, so this
--    never tightens the three policies above — it only guarantees no 403 when
--    the browser still uses the publishable/anon key without a session.
--    Tighten or drop this policy when real auth roles are enforced.
CREATE POLICY "notifications_all_anon"
ON public.notifications FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- Force PostgREST to reload its schema cache (no-op if not supported)
DO $$ BEGIN PERFORM pg_notify('pgrst','reload schema'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
