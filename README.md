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

## Authentication / Admin portal update
- Opening `admin.html` while signed out now redirects to `admin-login.html`.
- `admin-login.html` accepts the Supabase admin account, verifies administrator status server-side with `is_vexa_admin`, then redirects to `admin.html`.
- A normal user account cannot enter the admin portal; it is signed out and shown a clear message.
- Opening `admin.html` while signed in as a normal user shows an admin-access message and a switch-account flow.
- Normal user login now changes the header account action to `Dashboard` and adds `Log out` across public pages, so the logged-in state is visible.

### One-time admin role setup
If the admin account has not yet been given the `admin` role, run this in Supabase SQL Editor, replacing the email:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

The browser never receives the service-role key. Admin access is still checked through the database function `is_vexa_admin()`.


## 2026-09-26 checkpoint changes
- Signed-in account dropdown restored to the original account-style menu with Dashboard, Saved, Following, Notifications, Settings, Security & Privacy, Dark Mode, Language and Logout. Creator Dashboard/My Content are shown only to users granted creator access.
- Regular users use My Account; creator content management is separated into Creator Dashboard.
- Admin page now presents an admin login gate directly instead of an endless loading state; successful admin authentication opens the portal.
- Added creator access controls and server-side creator check helpers.
- Video cards and video detail pages show how long ago each video was uploaded.


## V4 checkpoint changes
- Reworked the shared header: hamburger inside the heading, centered site name, compact account/settings controls.
- Replaced the emoji account button with inline SVG user/gear icons.
- Compact profile dropdown opens directly under the profile icon; removed Language control.
- Dark Mode toggle now calls a real setTheme() function and persists locally/Supabase.
- Regular account menu no longer exposes Dashboard. Creator Dashboard is shown only to creator accounts.
- Added creator application page and Supabase creator application workflow/admin review.
- Creator profile now shows circular avatar, name, handle, country, views, Subscribe control, and Posts/Videos/Photos navigation.
- Added public creator profile view for guests without exposing account email/admin role.
- Upload page supports selecting multiple photos in one submission.
- Added dedicated Forgot Password and Reset Password pages.
- Admin page now redirects unauthenticated/non-admin visitors to the dedicated Admin Login page instead of leaving the portal on a loading gate.
- Preserved upload-age metadata on video cards and video pages.

- Added a dedicated `account.html` for regular accounts; the old `dashboard.html` URL redirects to Account so normal users do not get a Dashboard page.
