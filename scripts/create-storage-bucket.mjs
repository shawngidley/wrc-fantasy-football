/**
 * Creates the 'theme-songs' storage bucket in Supabase
 * and adds a column to teams table for theme_song_url
 */
const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdXJvYWRrZGlsdHpzdmFodWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTA1MTIsImV4cCI6MjEwMTM2NjUxMn0.MLm_s_b67aczRlF4e41dMJin8xPvQASTHDGHTIkdai4";

// Create bucket
const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${ANON_KEY}`,
  },
  body: JSON.stringify({
    id: "theme-songs",
    name: "theme-songs",
    public: true,
    file_size_limit: 10485760, // 10MB
    allowed_mime_types: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/aac"],
  }),
});

const bucketData = await bucketRes.json();
console.log("Bucket create response:", bucketRes.status, JSON.stringify(bucketData));
