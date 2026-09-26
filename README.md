# Vexa — v11 checkpoint

This checkpoint starts from `Vexa-master-2026-09-26-v10.zip` and applies the latest requested correction without rebuilding the site.

## Included corrections
- Restored demo video catalog and responsive video pagination.
- Homepage now includes Videos Being Watched, Recent Photos, and Trending Photos.
- Removed the homepage Add/+ control; the existing search icon remains for video search.
- Photos use the same card/catalog system as videos and open `photo.html`, not a blank/raw-image page.
- Added working photo detail page with demo-photo fallback.
- Added `profile.html` + `profile.js` with Reddit-style Vexa profile layout.
- Regular users get My Profile + About only; creator profiles get Posts, Comments, and About.
- Creator Dashboard remains hidden for regular users and available only to creators.
- Profile editing supports avatar, banner, display name, username, bio, and social link.
- Profile media uses the Supabase `profile-assets` storage bucket.
- Public profile shows follower/following counts, but not follower/following lists.
- Account age is shown only on the signed-in user's own profile.
- Public creator/profile links now route to `profile.html`.
- Login preserves a `returnTo` destination when supplied.
- Existing Supabase authentication, video pages, reactions, comments, saved/following features, admin files, and existing styling are preserved.

## Database
Run `Vexa-profile-photo-patch.sql` in Supabase if the database already has the v10 schema. It adds the profile fields, public-profile view fields, following count helper, profile media bucket/policies, and profile-creation helper needed by the new profile page.

`backend.sql` also contains the same database correction for a fresh/re-run backend setup.
