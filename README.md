# Vexa

A responsive video website frontend with Supabase Auth + database integration.

## Important
- Replace the placeholder publishable key in `supabase-config.js`.
- Never put a Supabase `service_role` key, secret key, JWT secret, or database password in frontend files.
- Netlify can host the frontend. Supabase provides authentication and database APIs.
- Video files themselves should be hosted only where you have permission to store/distribute them.

## Deploy
1. Upload all files to Netlify.
2. Edit `supabase-config.js` and paste your Supabase Project URL and Publishable key.
3. In Supabase Auth, add your Netlify site URL to the allowed redirect URLs.


## Latest corrections
- Original left sidebar retained; no hamburger menu.
- Home/video cards include an inline play button and muted hold/hover preview.
- Video detail actions are Like, Dislike, Download, Share. Save was removed.
- Share opens app choices (WhatsApp, Telegram, Facebook, X, Email) plus Copy link.
- Upload page supports actual video/photo files through Supabase Storage.
- 30 videos/photos per page with responsive two-column phone catalogs.
- Category appears on each catalog card.
