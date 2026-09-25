# YourSite responsive frontend
Single CSS file: style.css
Shared JavaScript: app.js
Open index.html to start.


## Supabase connection
This version preserves the existing login/signup pages and connects the browser client using the public anon key. It loads published rows from the `videos` table and uses Supabase Auth for login/signup. Keep service_role/secret keys out of the frontend. If videos do not appear, verify that the `videos` table has an RLS SELECT policy for published rows.
