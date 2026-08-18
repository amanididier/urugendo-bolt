// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://zrvcqlyowqfrqdidozrk.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydmNxbHlvd3FmcnFkaWRvenJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MzQ1MDQsImV4cCI6MjEwMjAxMDUwNH0.V-VKsa-W88E9VziKc2kD4GIi27SStOuzfCGoS2QJSNw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
    },
  },
});
