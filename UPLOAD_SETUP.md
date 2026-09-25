# Vexa upload setup

1. Deploy the site normally.
2. In Supabase SQL Editor, run `backend.sql` (or run the existing backend/admin SQL first, then the media/photo section at the bottom of `backend.sql`).
3. The SQL creates a public `media` Storage bucket, upload policies, and a `photos` table.
4. Users must be signed in before using `upload.html`.
5. The Upload page supports both **Video** and **Photo** tabs.
6. Video uploads accept a video file and an optional thumbnail. Photo uploads accept an image file.
7. The content date can be set during upload, so the administrator can later change it from Admin Dashboard.

## Admin date controls

Open `/admin.html` with the administrator account. Each video has:
- Now
- 7d old
- 30d old
- 1y old
- A custom date/time

Saving `created_at` changes the ordering used by the public catalog, so older content moves behind newer content.
