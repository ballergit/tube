Vexa v12 corrections

Starting checkpoint: Vexa-master-2026-09-26-v11.zip

Applied corrections:
- Home keeps Recent Photos as a smaller section than Videos.
- Home does not show Trending Photos.
- Video pagination: pages after page 1 show videos only; Recent Photos is hidden.
- Home photo pagination: pages after page 1 show photos only; Videos are hidden.
- Photo cards link to photo.html.
- Photo page has the video-style action bar, including Like and Dislike.
- Photo Like/Dislike counts persist through Supabase using set_photo_reaction.
- Photo like counts are displayed on photo cards.
- Trending Photos is shown on the Photo Page.
- Creator Dashboard was removed from the account dropdown.
- Dark Mode is aligned with the other account-menu text.
- The unwanted profile fallback/person icon was removed; guest account control displays Login text.

Database:
- Run Vexa-v12-photo-reactions.sql in Supabase once to add photo reaction storage and RPC support.
- The same idempotent SQL is also appended to backend.sql.
