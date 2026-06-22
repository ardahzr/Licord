/**
 * Supabase Edge Function: mint a LiveKit access token.
 *
 * POST /livekit-token  { room: string, name?: string }
 * → { token: string }
 *
 * The caller must pass a valid Supabase JWT in the Authorization header.
 * LiveKit API key/secret are read from Supabase secrets (never exposed to client).
 *
 * Deploy:
 *   supabase functions deploy livekit-token --no-verify-jwt
 *
 * Set secrets:
 *   supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // ---------- CORS preflight ----------
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // ---------- Validate caller's Supabase JWT ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or malformed Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const jwt = authHeader.replace("Bearer ", "");
    // New Supabase projects use sb_publishable_* keys. Prefer the key sent by
    // the authenticated client and keep the legacy built-in anon key as a
    // fallback for older projects.
    const supabaseApiKey = req.headers.get("apikey")?.trim() ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";
    if (!supabaseApiKey) {
      console.error("No Supabase API key available for session validation");
      return json({ error: "Server misconfiguration" }, 500);
    }

    // Verify via Supabase's /auth/v1/user endpoint (simple, no JWKS needed).
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: supabaseApiKey,
      },
    });
    if (!userRes.ok) {
      console.error("Supabase session validation failed", userRes.status);
      return json({ error: "Invalid Supabase session" }, 401);
    }
    const user = await userRes.json();
    const userId: string = user.id;

    // ---------- Parse request body ----------
    const body = await req.json();
    const room: string = body.room;
    // Identity always comes from the verified session. Never trust a client
    // supplied identity here, otherwise callers could impersonate another user.
    const identity = userId;
    const displayName: string = body.name ?? identity;

    if (!room) {
      return json({ error: "Missing 'room' in request body" }, 400);
    }

    // RLS-backed room authorization: a user may join only a visible server
    // voice channel, accepted friendship call, or one of their private groups.
    const restResource = room.startsWith("direct-friend-")
      ? `friends?id=eq.${
        encodeURIComponent(room.replace("direct-friend-", ""))
      }&status=eq.accepted&select=id`
      : room.startsWith("direct-group-")
      ? `group_chats?id=eq.${
        encodeURIComponent(room.replace("direct-group-", ""))
      }&select=id`
      : `channels?id=eq.${encodeURIComponent(room)}&type=eq.voice&select=id`;
    const accessRes = await fetch(`${supabaseUrl}/rest/v1/${restResource}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: supabaseApiKey,
      },
    });
    const allowedRows = accessRes.ok ? await accessRes.json() : [];
    if (!Array.isArray(allowedRows) || allowedRows.length === 0) {
      return json({ error: "You do not have access to this voice room" }, 403);
    }

    // ---------- Mint LiveKit token ----------
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!apiKey || !apiSecret) {
      console.error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set");
      return json({ error: "Server misconfiguration" }, 500);
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 6 * 60 * 60; // 6 hours

    const payload = {
      iss: apiKey,
      sub: identity,
      nbf: now,
      exp,
      jti: crypto.randomUUID(),
      name: displayName,
      video: {
        roomJoin: true,
        room,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      metadata: JSON.stringify({ userId }),
    };

    const secret = new TextEncoder().encode(apiSecret);
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(secret);

    return json({ token });
  } catch (err) {
    console.error("livekit-token error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
