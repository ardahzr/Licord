/**
 * Public configuration for the official Licord service.
 *
 * These values are intentionally client-visible. They identify the public
 * Supabase project, public media endpoint, and LiveKit websocket that official
 * Licord builds connect to automatically.
 *
 * Never add admin secrets here:
 * - Supabase service_role key
 * - R2 access/secret keys
 * - LiveKit API secret
 * - VPS credentials
 */
export const officialService = {
  supabase: {
    url: "https://bsflgxucabeoeaknmtpn.supabase.co",
    publishableKey: "sb_publishable_YqTe297xULGcdi2pahl2Zg_gbnpBr0B",
  },
  r2: {
    publicUrl: "https://pub-9894ac6a16d145979e15e27120b1b4e7.r2.dev",
    bucket: "better-vc",
    endpoint: "https://17468cb743850e78ba10dbeca133fb71.r2.cloudflarestorage.com",
  },
  livekit: {
    url: "ws://72.62.48.134",
  },
} as const;
