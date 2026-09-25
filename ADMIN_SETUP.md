# Vexa Admin Dashboard Setup

The admin portal is `admin.html`.

## 1. Run the SQL
Open your Supabase project's SQL Editor and run `admin.sql`.

## 2. Make your account an admin
First create/sign into the account you want to use as the site administrator.
Then in Supabase SQL Editor replace the email in this statement and run it:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email)=lower('YOUR-ADMIN-EMAIL@example.com');
```

Sign out and sign back in after changing the role so the new session contains the admin role.

## 3. Open the dashboard
After deployment:

`https://YOUR-NETLIFY-SITE/admin.html`

A normal account will be denied access.

## 4. What you can change
- Site name
- Site description
- Footer/copyright text
- Primary purple accent
- Secondary blue accent
- Light background/card colors
- Dark background/card colors
- Existing video content dates

## 5. Making content older/newer
In **Admin → Videos & Content Dates**, each video has a date/time field and quick buttons:
- Now
- 7d old
- 30d old
- 1y old

You can also enter any custom date/time and save it. The public video listing uses the content date when available, so changing the date lets you control whether content appears newer or older.

Never put a Supabase `service_role` key in the website. The included frontend key is the public/anon key.
