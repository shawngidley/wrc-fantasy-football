const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const SITE_ASSETS_BUCKET = "site-assets";

/**
 * Public URL for a static site asset (backgrounds, logo, chime, PWA icons).
 * Upload a file with this exact name to the `site-assets` Supabase Storage
 * bucket and it starts resolving immediately — no code change needed.
 */
export function siteAssetUrl(fileName: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SITE_ASSETS_BUCKET}/${fileName}`;
}
