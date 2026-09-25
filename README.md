# YourSite / Tube frontend

Supabase has been connected for browser-side reads using the public `anon` key.

Project URL: `https://rcdmmzsknzqwzvovubkp.supabase.co`

The home page now requests published rows from the `videos` table and renders the latest 12 videos.

Required columns for this first connection: `id`, `title`, `description`, `video_url`, `thumbnail_url`, `views`, `created_at`, `status`.

Keep Row Level Security enabled. Do not place a `service_role` or secret key in this frontend.
