-- VEXA ADMIN SETUP
-- 1) Run this in Supabase SQL Editor.
-- 2) Create/sign up your administrator account in Vexa.
-- 3) Replace ADMIN_EMAIL below with that exact email and run the UPDATE once.
--    Then sign out/in so the refreshed session contains the admin role.

create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings(key,value) values
('site_name','Vexa'),
('site_description','Responsive video and photo platform'),
('site_copyright','© 2026 Vexa — Authorized and demo content only.'),
('accent','#7c3aed'),
('accent2','#38bdf8'),
('dark_bg','#08090b'),
('dark_surface','#111318'),
('light_bg','#f5f6f8'),
('light_surface','#ffffff')
on conflict(key) do nothing;

alter table public.site_settings enable row level security;
drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings for select using (true);
drop policy if exists "site_settings_admin_insert" on public.site_settings;
create policy "site_settings_admin_insert" on public.site_settings for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update" on public.site_settings for update to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin') with check ((auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "site_settings_admin_delete" on public.site_settings;
create policy "site_settings_admin_delete" on public.site_settings for delete to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin');

-- Allow the admin to edit content dates. This does not grant normal users update access.
drop policy if exists "videos_admin_update" on public.videos;
create policy "videos_admin_update" on public.videos for update to authenticated
using ((auth.jwt()->'app_metadata'->>'role')='admin')
with check ((auth.jwt()->'app_metadata'->>'role')='admin');

-- OPTIONAL: if your existing videos policies do not allow admins to read all rows,
-- add this policy as well.
drop policy if exists "videos_admin_select" on public.videos;
create policy "videos_admin_select" on public.videos for select to authenticated
using ((auth.jwt()->'app_metadata'->>'role')='admin');

-- Give your account administrator privileges.
-- Replace the email before running this statement.
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where lower(email)=lower('YOUR-ADMIN-EMAIL@example.com');
