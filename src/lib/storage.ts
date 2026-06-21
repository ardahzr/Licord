/**
 * Cloudflare R2 media uploads (Phase 3).
 *
 * The R2 secret never touches the client: we ask the `upload-url` Supabase Edge
 * Function (authenticated with the user's JWT) for a short-lived presigned PUT
 * URL, then upload the bytes straight to R2 and store the public URL.
 */
import { supabase } from "@/lib/supabase";
import { env, r2PublicUrl } from "@/lib/env";

export { r2PublicUrl };

export type UploadKind = "image" | "video" | "file";

/** Pick an upload kind from a File's MIME type. */
export function fileKind(file: File): UploadKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export interface UploadResult {
  key: string;
  url: string;
}

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

const FUNCTION_URL = `${env.supabase.url.replace(/\/$/, "")}/functions/v1/upload-url`;

export async function uploadToR2(
  file: File,
  kind: UploadKind,
  scopeId: string,
): Promise<UploadResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be signed in to upload.");

  // 1) Get a presigned PUT URL from the Edge Function.
  const presignRes = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.supabase.publishableKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      kind,
      scopeId,
    }),
  });
  if (!presignRes.ok) {
    const detail = await presignRes.text().catch(() => "");
    throw new Error(`Could not get upload URL (${presignRes.status}). ${detail}`);
  }
  const { uploadUrl, publicUrl, key } =
    (await presignRes.json()) as PresignResponse;

  // 2) Upload the bytes straight to R2.
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload to R2 failed (${putRes.status}).`);
  }

  return { key, url: publicUrl };
}
