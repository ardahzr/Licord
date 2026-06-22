import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Fetch a short-lived LiveKit access token from our Supabase Edge Function.
 *
 * The Edge Function verifies the caller's Supabase JWT, then mints a LiveKit
 * token scoped to `roomName` with the caller's user ID as the identity.
 */
export async function fetchLiveKitToken(
  roomName: string,
  displayName?: string,
): Promise<string> {
  const {
    data: { session: storedSession },
  } = await supabase.auth.getSession();

  if (!storedSession) {
    throw new Error("Not authenticated — cannot fetch LiveKit token");
  }

  // getSession() reads local storage and can briefly return an expired JWT
  // after sleep/resume. Refresh proactively when it is close to expiry.
  let session = storedSession;
  const expiresSoon =
    !session.expires_at || session.expires_at <= Math.floor(Date.now() / 1000) + 60;
  if (expiresSoon) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      await clearInvalidSession();
    }
    session = data.session!;
  }

  const requestToken = (accessToken: string) =>
    fetch(`${env.supabase.url}/functions/v1/livekit-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.supabase.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: roomName, name: displayName }),
    });

  let res = await requestToken(session.access_token);

  // A token can be revoked server-side even when its local expiry looks valid.
  // Refresh once and retry instead of leaving the call screen in a dead end.
  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      await clearInvalidSession();
    }
    res = await requestToken(data.session!.access_token);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiveKit token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.token as string;
}

/** Clear an unrecoverable local session so RequireAuth returns to /login. */
async function clearInvalidSession(): Promise<never> {
  await supabase.auth.signOut({ scope: "local" });
  throw new Error("Your session expired. Sign in again to continue.");
}

/** LiveKit endpoint from env (`ws://IP:7880` or a TLS `wss://` endpoint). */
export const livekitUrl = env.livekit.url;

/** True when the LiveKit env var is configured. */
export const isLiveKitConfigured = (): boolean => Boolean(env.livekit.url);
