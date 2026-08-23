// Storage helpers backed by Supabase Storage.
// `storagePut` holds owner-uploaded team media (logos, theme songs).
// `storageGetSignedUrl` reads static site data snapshots (e.g. the completed
// season-stats JSON) out of the public site-assets bucket.

import { supabaseAdmin } from "./supabaseAdmin";

const TEAM_MEDIA_BUCKET = "team-media";
const SITE_ASSETS_BUCKET = "site-assets";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : data;

  const { error } = await supabaseAdmin.storage
    .from(TEAM_MEDIA_BUCKET)
    .upload(key, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: publicUrlData } = supabaseAdmin.storage.from(TEAM_MEDIA_BUCKET).getPublicUrl(key);
  return { key, url: publicUrlData.publicUrl };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const { data } = supabaseAdmin.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
