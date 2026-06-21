// Better-VC — Phase 3: presigned upload URL minter (Supabase Edge Function, Deno).
//
// Why this exists: the R2 secret access key must never reach the client. The app
// calls this function (with the user's JWT); we verify the user, then hand back a
// short-lived presigned PUT URL so the browser/Tauri shell uploads straight to R2
// without ever seeing the secret.
//
// Deploy:  supabase functions deploy upload-url
// Secrets: supabase secrets set R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
//            R2_BUCKET_NAME=better-vc R2_ENDPOINT=https://<acct>.r2.cloudflarestorage.com \
//            R2_PUBLIC_URL=https://pub-<id>.r2.dev
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRESIGN_TTL_SECONDS = 300; // 5 min — plenty for a single upload

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // --- 1) Verify the caller is a signed-in user ---
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "missing bearer token" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!userRes.ok) return json({ error: "unauthorized" }, 401);

  // --- 2) Build the object key ---
  let payload: {
    fileName?: string;
    contentType?: string;
    kind?: string;
    scopeId?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!payload.fileName) return json({ error: "fileName is required" }, 400);

  const kind = payload.kind ?? "file";
  const scope = sanitize(payload.scopeId ?? "misc");
  const key = `${kind}/${scope}/${Date.now()}-${sanitize(payload.fileName)}`;

  // --- 3) Sign a short-lived PUT URL for R2 ---
  const endpoint = Deno.env.get("R2_ENDPOINT")!; // https://<acct>.r2.cloudflarestorage.com
  const bucket = Deno.env.get("R2_BUCKET_NAME")!;
  const publicBase = Deno.env.get("R2_PUBLIC_URL")!;

  const aws = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    region: "auto",
    service: "s3",
  });

  // Content-Type is intentionally NOT signed, so the client may PUT with the
  // file's own type without a signature mismatch.
  const target = new URL(`${endpoint}/${bucket}/${key}`);
  target.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));

  const signed = await aws.sign(target.toString(), {
    method: "PUT",
    aws: { signQuery: true },
  });

  return json({
    uploadUrl: signed.url,
    publicUrl: `${publicBase.replace(/\/$/, "")}/${key}`,
    key,
  });
});
