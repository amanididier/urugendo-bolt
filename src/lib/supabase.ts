// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Canonical project URL — use this for every supabase-js call so .functions.invoke
// and .rpc point to the same project ref (zrvcqlyowqfrqdido). The old .env mix
// left NEXT_PUBLIC_SUPABASE_URL pointing anywhere.
const SUPABASE_URL = "https://zrvcqlyowqfrqdidozrk.supabase.co";

// Prefer the publishable JWT; fall back to legacy anon key for local dev where
// .env.local still has the old key. supabase-js will use whichever is present.
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_0_K8ivC1kuXNMg2k74Jt9g_KhvZ-71Y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
