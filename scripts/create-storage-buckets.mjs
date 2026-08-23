// Creates the `team-media` and `site-assets` Supabase Storage buckets used by
// server/storage.ts after moving off Manus's Forge-backed storage. Requires
// SUPABASE_SERVICE_ROLE_KEY in the environment. Idempotent — safe to re-run.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set in this shell.");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const buckets = [
  {
    id: "team-media",
    public: true,
    file_size_limit: 10 * 1024 * 1024,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/aac", "audio/x-m4a"],
  },
  {
    id: "site-assets",
    public: true,
    file_size_limit: 10 * 1024 * 1024,
    allowed_mime_types: null,
  },
];

for (const bucket of buckets) {
  const { data: existing } = await supabaseAdmin.storage.getBucket(bucket.id);
  if (existing) {
    console.log(`Bucket "${bucket.id}" already exists — skipping.`);
    continue;
  }
  const { error } = await supabaseAdmin.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  });
  if (error) {
    console.error(`Failed to create bucket "${bucket.id}":`, error.message);
    process.exitCode = 1;
    continue;
  }
  console.log(`Created bucket "${bucket.id}".`);
}
