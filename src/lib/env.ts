import { officialService } from "@/lib/officialService";

/**
 * Centralized access to public Licord service configuration.
 *
 * Official builds connect to the hosted Licord service by default. Developers
 * can still override these public endpoints with VITE_* variables in `.env`
 * when testing a self-hosted backend.
 */

function read(key: keyof ImportMetaEnv): string {
  return import.meta.env[key] ?? "";
}

const configuredOrOfficial = (value: string, fallback: string): string =>
  value.trim() || fallback;

export const env = {
  supabase: {
    url: configuredOrOfficial(read("VITE_SUPABASE_URL"), officialService.supabase.url),
    // New Supabase key naming: `sb_publishable_...` (client-safe, replaces anon JWT).
    publishableKey: configuredOrOfficial(
      read("VITE_SUPABASE_PUBLISHABLE_KEY"),
      officialService.supabase.publishableKey,
    ),
  },
  r2: {
    publicUrl: configuredOrOfficial(read("VITE_R2_PUBLIC_URL"), officialService.r2.publicUrl),
    bucket: configuredOrOfficial(read("VITE_R2_BUCKET_NAME"), officialService.r2.bucket),
    endpoint: configuredOrOfficial(read("VITE_R2_ENDPOINT"), officialService.r2.endpoint),
  },
  livekit: {
    url: configuredOrOfficial(read("VITE_LIVEKIT_URL"), officialService.livekit.url),
  },
} as const;

/** True when Supabase credentials are present (gates real backend calls). */
export const isSupabaseConfigured = (): boolean =>
  Boolean(env.supabase.url && env.supabase.publishableKey);

/** Build a public R2 URL from a stored object key. */
export const r2PublicUrl = (key: string): string =>
  `${env.r2.publicUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
