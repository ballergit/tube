# Vexa

A responsive video website frontend with Supabase Auth + database integration.

## Important
- Replace the placeholder publishable key in `supabase-config.js`.
- Never put a Supabase `service_role` key, secret key, JWT secret, or database password in frontend files.
- GitHub Pages hosts the frontend. Supabase provides authentication and database APIs.
- Video files themselves should be hosted only where you have permission to store/distribute them.

## Deploy
1. Upload all files to your GitHub repository.
2. Edit `supabase-config.js` and paste your Supabase Project URL and Publishable key.
3. Enable GitHub Pages for the repository.
4. In Supabase Auth, add your GitHub Pages URL to the allowed redirect URLs.


Latest UI update: sidebar navigation is text-only; Upload matches other navigation links; guest comments are supported through moderated anonymous comments; mobile catalog/search is compact and borderless.
