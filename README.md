# Vexa current project

This ZIP is based on the previously supplied Vexa project and includes the requested master-checklist changes without replacing the project with a separate site.

## Included in this update
- Restored hamburger navigation with the requested text-only sidebar.
- Removed the public `Search Videos` bar from the site pages.
- Home page uses the requested dark, responsive two-column mobile video layout and `Videos Being Watched` section.
- Photos use the same responsive content-card approach.
- Video pages use the requested title/metadata/tag/action layout with Like, Dislike, Comments, Download, Save, Share and Report controls.
- Related videos support `See more` loading.
- Removed the guest-comment explanatory notice while keeping guest comments and server-side moderation.
- Creator follow/unfollow support.
- Front-end user dashboard for managing only the logged-in user's own uploads.
- `/admin.html` admin access verification fixed and checked through Supabase server-side RPC/RLS.
- Admin video/photo editing, moderation, publishing, deletion and editable posted date/time.
- Admin direct video/photo upload and publish.
- Admin homepage section reorder/toggle controls.
- Admin site name, logo upload/URL, favicon, colors, navigation and footer controls.
- Server-enforced database/RLS rules for user-owned content, comments, follows, saved videos and admin operations.
- Storage buckets/policies for media and site assets are included in `backend.sql`.

## Supabase setup
Run the complete `backend.sql` file in the Supabase SQL Editor before using the new database-backed features. The browser uses only the Supabase publishable/anon key in `supabase-config.js`; never put a service-role/secret key in frontend code.

## Important
The existing Supabase project/schema is treated as the source of truth. The SQL uses additive migrations, `if not exists`, `drop policy if exists`, and `create or replace` patterns where practical.
