import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Single Supabase client for Auth, Postgres queries, and Realtime.
 *
 * If env vars are absent (e.g. Phase 1 UI-only runs), we still construct a
 * client against harmless placeholders so imports never crash — actual calls
 * should be gated behind `isSupabaseConfigured()`. Wiring real Auth/Realtime
 * flows is Phase 2.
 */
export const supabase = createClient(
  env.supabase.url || "http://localhost:54321",
  env.supabase.publishableKey || "publishable-placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // desktop app, not a redirect-based web flow
    },
  },
);

export { isSupabaseConfigured };
