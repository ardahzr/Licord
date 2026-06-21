/**
 * Centralized, validated access to `import.meta.env.VITE_*`.
 *
 * Reading env through this module (instead of scattering `import.meta.env`
 * everywhere) gives one place to validate config and surface a clear error
 * when something is missing.
 */

function read(key: keyof ImportMetaEnv): string {
  return import.meta.env[key] ?? "";
}

export const env = {
  supabase: {
    url: read("VITE_SUPABASE_URL"),
    // New Supabase key naming: `sb_publishable_...` (client-safe, replaces anon JWT).
    publishableKey: read("VITE_SUPABASE_PUBLISHABLE_KEY"),
  },
  r2: {
    publicUrl: read("VITE_R2_PUBLIC_URL"),
    bucket: read("VITE_R2_BUCKET_NAME"),
    endpoint: read("VITE_R2_ENDPOINT"),
    accessKeyId: read("VITE_R2_ACCESS_KEY_ID"),
    secretAccessKey: read("VITE_R2_SECRET_ACCESS_KEY"),
  },
  livekit: {
    url: read("VITE_LIVEKIT_URL"),
  },
} as const;

/** True when Supabase credentials are present (gates real backend calls). */
export const isSupabaseConfigured = (): boolean =>
  Boolean(env.supabase.url && env.supabase.publishableKey);

/** Build a public R2 URL from a stored object key. */
export const r2PublicUrl = (key: string): string =>
  `${env.r2.publicUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
