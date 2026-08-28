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

// Vercel's Node.js serverless functions enforce a hard ~4.5MB request body
// limit at the platform level -- not configurable via vercel.json, and not
// affected by Express's own body-parser limit (that limit never gets a
// chance to apply; Vercel rejects the request first, with a plain-text
// "Request Entity Too Large" response the client can't JSON.parse). Any
// upload that needs to support files larger than that must not send the
// file bytes through our own API route at all. This returns a short-lived
// signed upload URL/token the browser can upload directly to Supabase
// Storage with, bypassing our function entirely for the actual bytes; only
// the (small) URL to attach gets sent back to us afterward.
export async function createTeamMediaSignedUploadUrl(
  relKey: string,
): Promise<{ path: string; token: string; publicUrl: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const { data, error } = await supabaseAdmin.storage.from(TEAM_MEDIA_BUCKET).createSignedUploadUrl(key);
  if (error || !data) throw new Error(`Unable to prepare upload: ${error?.message ?? "unknown error"}`);
  const { data: publicUrlData } = supabaseAdmin.storage.from(TEAM_MEDIA_BUCKET).getPublicUrl(key);
  return { path: data.path, token: data.token, publicUrl: publicUrlData.publicUrl };
}

/** The team-media bucket name, exported so callers can validate an attached
 * URL actually points into it before trusting/persisting it. */
export const TEAM_MEDIA_BUCKET_NAME = TEAM_MEDIA_BUCKET;

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const { data } = supabaseAdmin.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
