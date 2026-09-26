-- VEXA BACKEND: full admin portal, publishing workflow, creators, comments,
-- reactions, views, categories, tags, site settings.
-- Safe to re-run: everything uses if-not-exists / or-replace / drop-if-exists.
-- Run the whole file once in the Supabase SQL Editor.

-- ============================================================
-- PROFILES (users + roles)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  is_creator boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists is_creator boolean not null default false;

-- VEXA ADMIN ACCOUNT / GITHUB ADMIN
-- The configured Vexa admin signs in through GitHub OAuth.
-- The GitHub account must return this email from the OAuth identity for the email-based admin rule below to match.
-- This email is an administrator account. The check is based on the
-- authenticated Supabase email as well as the profile role, so the admin
-- can access the admin portal even if the profile row has not yet been
-- promoted manually.
create or replace function public.is_vexa_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select auth.uid() is not null and (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
    or lower(coalesce(auth.jwt()->>'email','')) = lower('Gnballer96@gmail.com')
  );
$$;
grant execute on function public.is_vexa_admin() to anon, authenticated;

create or replace function public.is_vexa_creator()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_creator=true); $$;
grant execute on function public.is_vexa_creator() to anon, authenticated;

-- SECURITY: profiles previously had no RLS at all, meaning any signed-in
-- user could grant themselves the admin role directly through the client.
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_vexa_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_admin_update_any" on public.profiles;
create policy "profiles_admin_update_any" on public.profiles
for update to authenticated using (public.is_vexa_admin()) with check (public.is_vexa_admin());

-- Even with the update policy open, only an existing admin may change `role`.
create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role is distinct from old.role and not public.is_vexa_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;
drop trigger if exists profiles_block_role_escalation on public.profiles;
create trigger profiles_block_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_self_escalation();

-- New users get a profile from auth metadata.
create or replace function public.handle_vexa_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
  insert into public.profiles(id,username,display_name,role)
  values(
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'username'),
    case when lower(coalesce(new.email,''))=lower('Gnballer96@gmail.com') then 'admin' else 'user' end
  )
  on conflict(id) do update set
    username=coalesce(excluded.username,profiles.username),
    display_name=coalesce(excluded.display_name,profiles.display_name),
    role=case when lower(coalesce(new.email,''))=lower('Gnballer96@gmail.com') then 'admin' else profiles.role end;
  return new;
end $$;
drop trigger if exists on_auth_user_created_vexa on auth.users;
create trigger on_auth_user_created_vexa after insert on auth.users for each row execute function public.handle_vexa_new_user();

-- Promote the existing account with the configured admin email when it exists.
update public.profiles p
set role='admin'
from auth.users u
where p.id=u.id and lower(coalesce(u.email,''))=lower('Gnballer96@gmail.com');

-- ============================================================
-- VIDEOS: publishing workflow, featured/trending, scheduling
-- ============================================================
alter table public.videos add column if not exists uploader_id uuid references auth.users(id) on delete set null;
alter table public.videos add column if not exists status text not null default 'published';
alter table public.videos add column if not exists submitted_at timestamptz default now();
alter table public.videos add column if not exists approved_at timestamptz;
alter table public.videos add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.videos add column if not exists uploader_name text;
alter table public.videos add column if not exists featured boolean not null default false;
alter table public.videos add column if not exists trending boolean not null default false;
alter table public.videos add column if not exists published_at timestamptz default now();

-- SECURITY: the base videos table previously had no RLS at all, meaning any
-- signed-in user could publish/feature/delete ANY video directly through the
-- client, bypassing moderation entirely. This was only "hidden" by the
-- frontend, never enforced. Fixed below.
alter table public.videos enable row level security;

drop policy if exists "videos_select_public" on public.videos;
create policy "videos_select_public" on public.videos
for select using (coalesce(status,'published')='published' or auth.uid()=uploader_id or public.is_vexa_admin());

drop policy if exists "videos_insert_own" on public.videos;
create policy "videos_insert_own" on public.videos
for insert to authenticated with check (auth.uid()=uploader_id);

drop policy if exists "videos_update_own_or_admin" on public.videos;
create policy "videos_update_own_or_admin" on public.videos
for update to authenticated
using (auth.uid()=uploader_id or public.is_vexa_admin())
with check (auth.uid()=uploader_id or public.is_vexa_admin());

drop policy if exists "videos_delete_admin" on public.videos;
create policy "videos_delete_admin" on public.videos
for delete to authenticated using (public.is_vexa_admin());

-- On INSERT: a normal uploader always lands as pending, un-featured, not
-- trending, regardless of what the client sends. An admin's upload can go
-- straight to published (this is the "admin uploads skip approval" rule).
create or replace function public.guard_video_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then
    new.status := 'pending';
    new.featured := false;
    new.trending := false;
    new.approved_at := null;
    new.approved_by := null;
  end if;
  new.published_at := coalesce(new.published_at, now());
  return new;
end $$;
drop trigger if exists videos_guard_insert on public.videos;
create trigger videos_guard_insert before insert on public.videos for each row execute function public.guard_video_insert();

-- On UPDATE: an owner can still edit their own title/description/thumbnail/
-- category/tags, but cannot self-approve, self-feature, or backdate.
create or replace function public.guard_video_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then
    new.status := old.status;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.featured := old.featured;
    new.trending := old.trending;
    new.published_at := old.published_at;
    new.uploader_id := old.uploader_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists videos_guard_update on public.videos;
create trigger videos_guard_update before update on public.videos for each row execute function public.guard_video_update();

-- Public catalog view: only published videos, ordered for the homepage.
create or replace view public.vexa_published_videos as
select v.* from public.videos v where coalesce(v.status,'published')='published';

-- ============================================================
-- PHOTOS: same workflow as videos
-- ============================================================
create table if not exists public.photos (
  id bigint generated by default as identity primary key,
  title text,
  description text,
  image_url text not null,
  thumbnail_url text,
  category text default 'General',
  tags text[] not null default '{}',
  uploader_id uuid references auth.users(id) on delete set null,
  uploader_name text,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  featured boolean not null default false,
  submitted_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.photos add column if not exists category text default 'General';
alter table public.photos add column if not exists tags text[] not null default '{}';
alter table public.photos add column if not exists featured boolean not null default false;

alter table public.photos enable row level security;
drop policy if exists "photos_select_public" on public.photos;
create policy "photos_select_public" on public.photos
for select using (status='published' or auth.uid()=uploader_id or public.is_vexa_admin());
drop policy if exists "photos_insert_own" on public.photos;
create policy "photos_insert_own" on public.photos
for insert to authenticated with check (auth.uid()=uploader_id);
drop policy if exists "photos_update_own_or_admin" on public.photos;
create policy "photos_update_own_or_admin" on public.photos
for update to authenticated
using (auth.uid()=uploader_id or public.is_vexa_admin())
with check (auth.uid()=uploader_id or public.is_vexa_admin());
drop policy if exists "photos_delete_admin" on public.photos;
create policy "photos_delete_admin" on public.photos
for delete to authenticated using (public.is_vexa_admin());

create or replace function public.guard_photo_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then
    new.status := 'pending'; new.featured := false; new.approved_at := null; new.approved_by := null;
  end if;
  return new;
end $$;
drop trigger if exists photos_guard_insert on public.photos;
create trigger photos_guard_insert before insert on public.photos for each row execute function public.guard_photo_insert();

create or replace function public.guard_photo_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then
    new.status := old.status; new.approved_at := old.approved_at; new.approved_by := old.approved_by;
    new.featured := old.featured; new.uploader_id := old.uploader_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists photos_guard_update on public.photos;
create trigger photos_guard_update before update on public.photos for each row execute function public.guard_photo_update();

create or replace view public.vexa_published_photos as
select p.* from public.photos p where p.status='published';

-- ============================================================
-- CATEGORIES (admin-managed canonical list)
-- ============================================================
create table if not exists public.categories (
  id bigint generated by default as identity primary key,
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public" on public.categories for select using (true);
drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories for all to authenticated
using (public.is_vexa_admin()) with check (public.is_vexa_admin());

insert into public.categories (name, slug)
values ('Entertainment','entertainment'), ('Music','music'), ('Sports','sports'), ('Education','education')
on conflict (name) do nothing;

create or replace function public.vexa_rename_category(p_old text, p_new text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  update public.categories set name=p_new where name=p_old;
  update public.videos set category=p_new where category=p_old;
  update public.photos set category=p_new where category=p_old;
end $$;
grant execute on function public.vexa_rename_category(text,text) to authenticated;

create or replace function public.vexa_delete_category(p_name text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  delete from public.categories where name=p_name;
  update public.videos set category='General' where category=p_name;
  update public.photos set category='General' where category=p_name;
end $$;
grant execute on function public.vexa_delete_category(text) to authenticated;

-- ============================================================
-- TAGS (admin-managed canonical list; content keeps its own tags[] array)
-- ============================================================
create table if not exists public.tags (
  id bigint generated by default as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);
alter table public.tags enable row level security;
drop policy if exists "tags_select_public" on public.tags;
create policy "tags_select_public" on public.tags for select using (true);
drop policy if exists "tags_admin_write" on public.tags;
create policy "tags_admin_write" on public.tags for all to authenticated
using (public.is_vexa_admin()) with check (public.is_vexa_admin());

create or replace function public.vexa_rename_tag(p_old text, p_new text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  update public.tags set name=p_new where name=p_old;
  update public.videos set tags = array_replace(tags, p_old, p_new) where p_old = any(tags);
  update public.photos set tags = array_replace(tags, p_old, p_new) where p_old = any(tags);
end $$;
grant execute on function public.vexa_rename_tag(text,text) to authenticated;

create or replace function public.vexa_delete_tag(p_tag text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  delete from public.tags where name=p_tag;
  update public.videos set tags = array_remove(tags, p_tag) where p_tag = any(tags);
  update public.photos set tags = array_remove(tags, p_tag) where p_tag = any(tags);
end $$;
grant execute on function public.vexa_delete_tag(text) to authenticated;

-- ============================================================
-- SITE SETTINGS (name, logo, favicon, contact, social, theme, nav, footer)
-- ============================================================
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Vexa',
  description text not null default '',
  logo_url text,
  favicon_url text,
  contact_email text,
  social jsonb not null default '{}'::jsonb,
  accent_color text not null default '#6d5efc',
  nav_items jsonb not null default '[
    {"label":"Home","href":"index.html"},
    {"label":"Videos","href":"videos.html"},
    {"label":"Categories","href":"categories.html"},
    {"label":"Tags","href":"tags.html"},
    {"label":"Community","href":"community.html"},
    {"label":"Photos","href":"photos.html"},
    {"label":"UPLOAD","href":"upload.html"}
  ]'::jsonb,
  footer_text text not null default '© 2026 Vexa',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;
drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public" on public.site_settings for select using (true);
drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update" on public.site_settings for update to authenticated
using (public.is_vexa_admin()) with check (public.is_vexa_admin());

-- ============================================================
-- COMMENTS (guest + logged-in, moderated)
-- ============================================================
create table if not exists public.video_comments (
  id bigint generated by default as identity primary key,
  video_id bigint not null references public.videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_name text,
  body text not null check (length(trim(body)) between 1 and 1000),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  check (user_id is not null or length(trim(coalesce(guest_name,''))) between 1 and 80)
);
alter table public.video_comments alter column user_id drop not null;
alter table public.video_comments add column if not exists guest_name text;
create index if not exists video_comments_video_idx on public.video_comments(video_id,created_at desc);
alter table public.video_comments enable row level security;
drop policy if exists "comments_public_approved" on public.video_comments;
create policy "comments_public_approved" on public.video_comments for select using (status='approved' or auth.uid()=user_id or public.is_vexa_admin());
drop policy if exists "comments_insert_own" on public.video_comments;
create policy "comments_insert_own" on public.video_comments for insert to authenticated with check(auth.uid()=user_id and status='pending');
drop policy if exists "comments_insert_guest" on public.video_comments;
create policy "comments_insert_guest" on public.video_comments for insert to anon, authenticated with check(user_id is null and length(trim(coalesce(guest_name,''))) between 1 and 80 and status='pending');
drop policy if exists "comments_admin_update" on public.video_comments;
create policy "comments_admin_update" on public.video_comments for update to authenticated using(public.is_vexa_admin()) with check(public.is_vexa_admin());
drop policy if exists "comments_admin_delete" on public.video_comments;
create policy "comments_admin_delete" on public.video_comments for delete to authenticated using(public.is_vexa_admin());

-- ============================================================
-- REACTIONS (like/dislike)
-- ============================================================
create table if not exists public.reactions (
  id bigint generated by default as identity primary key,
  video_id bigint not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','dislike')),
  created_at timestamptz not null default now(),
  unique(video_id,user_id)
);
alter table public.reactions enable row level security;
drop policy if exists "reactions_select_public" on public.reactions;
create policy "reactions_select_public" on public.reactions for select using (true);
drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own" on public.reactions for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "reactions_update_own" on public.reactions;
create policy "reactions_update_own" on public.reactions for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own" on public.reactions for delete to authenticated using(auth.uid()=user_id);

create or replace function public.set_video_reaction(p_video_id bigint,p_reaction text)
returns table(likes bigint,dislikes bigint) language plpgsql security definer set search_path=public as $$
declare old_reaction text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to react'; end if;
  if p_reaction not in ('like','dislike') then raise exception 'Invalid reaction'; end if;
  select reaction into old_reaction from public.reactions where video_id=p_video_id and user_id=auth.uid();
  if old_reaction=p_reaction then delete from public.reactions where video_id=p_video_id and user_id=auth.uid();
  else insert into public.reactions(video_id,user_id,reaction) values(p_video_id,auth.uid(),p_reaction) on conflict(video_id,user_id) do update set reaction=excluded.reaction,created_at=now(); end if;
  update public.videos set likes=(select count(*) from public.reactions where video_id=public.videos.id and reaction='like'),dislikes=(select count(*) from public.reactions where video_id=public.videos.id and reaction='dislike') where id=p_video_id;
  return query select v.likes,v.dislikes from public.videos v where v.id=p_video_id;
end $$;
grant execute on function public.set_video_reaction(bigint,text) to authenticated;

-- ============================================================
-- VIEW TRACKING
-- ============================================================
create table if not exists public.video_view_events(id bigint generated by default as identity primary key,video_id bigint not null references public.videos(id) on delete cascade,user_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
alter table public.video_view_events enable row level security;
drop policy if exists "view_events_insert_authenticated" on public.video_view_events;
create policy "view_events_insert_authenticated" on public.video_view_events for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "view_events_insert_guest" on public.video_view_events;
create policy "view_events_insert_guest" on public.video_view_events for insert to anon with check(user_id is null);
create or replace function public.record_video_view(p_video_id bigint) returns bigint language plpgsql security definer set search_path=public as $$ declare new_views bigint; begin insert into public.video_view_events(video_id,user_id) values(p_video_id,auth.uid()); update public.videos set views=coalesce(views,0)+1 where id=p_video_id returning views into new_views; return new_views; end $$;
grant execute on function public.record_video_view(bigint) to anon, authenticated;

-- Public creator directory data. It exposes only creator-facing fields and aggregate content counts.
create or replace function public.vexa_public_creators()
returns table(
  id uuid,
  username text,
  display_name text,
  country text,
  avatar_url text,
  posts bigint,
  views bigint,
  latest_post timestamptz,
  tags text[]
) language sql stable security definer set search_path=public
as $$
  select p.id,p.username,p.display_name,p.country,p.avatar_url,
    (select count(*) from public.videos v where v.uploader_id=p.id and v.status='published') +
    (select count(*) from public.photos ph where ph.uploader_id=p.id and ph.status='published'),
    coalesce((select sum(coalesce(v.views,0)) from public.videos v where v.uploader_id=p.id and v.status='published'),0),
    greatest((select max(v.created_at) from public.videos v where v.uploader_id=p.id and v.status='published'),(select max(ph.created_at) from public.photos ph where ph.uploader_id=p.id and ph.status='published')),
    '{}'::text[]
  from public.profiles p
  where p.is_creator=true
  order by posts desc, p.display_name nulls last;
$$;
grant execute on function public.vexa_public_creators() to anon, authenticated;

-- ============================================================
-- ============================================================
-- CREATOR ACCESS + PRIVATE CREATOR STATS
-- ============================================================
-- Creator profile views are private analytics; only aggregate counts are exposed to the creator.
create table if not exists public.creator_profile_view_events (
  id bigint generated by default as identity primary key,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.creator_profile_view_events enable row level security;
drop policy if exists "creator_profile_views_none" on public.creator_profile_view_events;
create policy "creator_profile_views_none" on public.creator_profile_view_events for select to authenticated using(false);
create or replace function public.record_creator_profile_view(p_creator_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_creator_id is null or p_creator_id=auth.uid() then return; end if;
  if not exists(select 1 from public.profiles where id=p_creator_id and is_creator=true) then return; end if;
  insert into public.creator_profile_view_events(creator_id,viewer_id) values(p_creator_id,auth.uid());
end $$;
grant execute on function public.record_creator_profile_view(uuid) to anon, authenticated;

create or replace function public.vexa_creator_stats()
returns jsonb language sql stable security definer set search_path=public
as $$
  select case when not public.is_vexa_creator() then '{}'::jsonb else jsonb_build_object(
    'videos', (select count(*) from public.videos where uploader_id=auth.uid()),
    'photos', (select count(*) from public.photos where uploader_id=auth.uid()),
    'published', (select count(*) from public.videos where uploader_id=auth.uid() and status='published') + (select count(*) from public.photos where uploader_id=auth.uid() and status='published'),
    'pending', (select count(*) from public.videos where uploader_id=auth.uid() and status='pending') + (select count(*) from public.photos where uploader_id=auth.uid() and status='pending'),
    'views', coalesce((select sum(coalesce(views,0)) from public.videos where uploader_id=auth.uid()),0),
    'likes', coalesce((select sum(coalesce(likes,0)) from public.videos where uploader_id=auth.uid()),0),
    'comments', (select count(*) from public.video_comments c join public.videos v on v.id=c.video_id where v.uploader_id=auth.uid()),
    'followers', (select count(*) from public.creator_followers where creator_id=auth.uid()),
    'profile_views', (select count(*) from public.creator_profile_view_events where creator_id=auth.uid()),
    'saves', (select count(*) from public.saved_videos s join public.videos v on v.id=s.video_id where v.uploader_id=auth.uid())
  ) end;
$$;
grant execute on function public.vexa_creator_stats() to authenticated;

-- ADMIN MODERATION HELPERS
-- ============================================================
create or replace function public.vexa_moderate_video(p_video_id bigint,p_status text)
returns void language plpgsql security definer set search_path=public as $$ begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('published','rejected','pending') then raise exception 'Invalid status'; end if;
  update public.videos set status=p_status,approved_at=case when p_status='published' then now() else approved_at end,approved_by=case when p_status='published' then auth.uid() else approved_by end where id=p_video_id;
end $$;
grant execute on function public.vexa_moderate_video(bigint,text) to authenticated;

create or replace function public.vexa_moderate_photo(p_photo_id bigint,p_status text)
returns void language plpgsql security definer set search_path=public as $$ begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('published','rejected','pending') then raise exception 'Invalid status'; end if;
  update public.photos set status=p_status,approved_at=case when p_status='published' then now() else approved_at end,approved_by=case when p_status='published' then auth.uid() else approved_by end where id=p_photo_id;
end $$;
grant execute on function public.vexa_moderate_photo(bigint,text) to authenticated;

-- Dashboard counts in one round trip.
create or replace function public.vexa_admin_stats()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when not public.is_vexa_admin() then '{}'::jsonb else jsonb_build_object(
    'total_videos', (select count(*) from public.videos),
    'pending_videos', (select count(*) from public.videos where status='pending'),
    'published_videos', (select count(*) from public.videos where status='published'),
    'total_photos', (select count(*) from public.photos),
    'pending_photos', (select count(*) from public.photos where status='pending'),
    'users', (select count(*) from public.profiles),
    'comments', (select count(*) from public.video_comments),
    'pending_comments', (select count(*) from public.video_comments where status='pending'),
    'categories', (select count(*) from public.categories),
    'tags', (select count(*) from public.tags)
  ) end;
$$;
grant execute on function public.vexa_admin_stats() to authenticated;

-- ============================================================
-- USER DASHBOARD + CREATOR FOLLOWING
-- ============================================================
-- Users can remove their own uploads; admins retain full control.
drop policy if exists "videos_delete_own_or_admin" on public.videos;
create policy "videos_delete_own_or_admin" on public.videos
for delete to authenticated using (auth.uid()=uploader_id or public.is_vexa_admin());

drop policy if exists "photos_delete_own_or_admin" on public.photos;
create policy "photos_delete_own_or_admin" on public.photos
for delete to authenticated using (auth.uid()=uploader_id or public.is_vexa_admin());

-- Persistent creator/user following relationships.
create table if not exists public.creator_followers (
  follower_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);
alter table public.creator_followers enable row level security;
drop policy if exists "creator_followers_public_read" on public.creator_followers;
drop policy if exists "creator_followers_select_own" on public.creator_followers;
create policy "creator_followers_select_own" on public.creator_followers
for select to authenticated using (auth.uid()=follower_id);
drop policy if exists "creator_followers_insert_own" on public.creator_followers;
create policy "creator_followers_insert_own" on public.creator_followers
for insert to authenticated with check (auth.uid()=follower_id and follower_id<>creator_id);
drop policy if exists "creator_followers_delete_own" on public.creator_followers;
create policy "creator_followers_delete_own" on public.creator_followers
for delete to authenticated using (auth.uid()=follower_id);
create index if not exists creator_followers_creator_idx on public.creator_followers(creator_id);

-- Creator page/dashboard helper counts.
create or replace function public.vexa_follow_counts(p_creator_id uuid)
returns bigint
language sql stable security definer set search_path=public
as $$ select count(*) from public.creator_followers where creator_id=p_creator_id $$;
grant execute on function public.vexa_follow_counts(uuid) to anon, authenticated;

-- ============================================================
-- FINAL MASTER CHECKLIST ADDITIONS
-- ============================================================

-- Video display metadata and editable lifecycle states.
alter table public.videos add column if not exists quality text;
alter table public.videos add column if not exists duration text;

-- Photos use the same status lifecycle as the user dashboard.
alter table public.photos add column if not exists updated_at timestamptz not null default now();

-- Homepage section ordering/toggle configuration.
alter table public.site_settings add column if not exists homepage_sections jsonb not null default '{"order":["watched","latest","featured","trending"],"enabled":["watched"]}'::jsonb;

-- Keep site_settings.updated_at current whenever the admin changes settings.
create or replace function public.touch_vexa_site_settings()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings for each row execute function public.touch_vexa_site_settings();

create or replace function public.vexa_set_creator(p_user_id uuid, p_is_creator boolean)
returns text language plpgsql security definer set search_path=public as $$
begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  update public.profiles set is_creator=coalesce(p_is_creator,false) where id=p_user_id;
  return case when p_is_creator then 'User granted creator access.' else 'Creator access removed.' end;
end $$;
grant execute on function public.vexa_set_creator(uuid,boolean) to authenticated;

-- Server-side admin promotion by email. The service-role key is never exposed
-- to the browser; this function performs the privileged auth.users lookup.
create or replace function public.vexa_promote_user_by_email(p_email text)
returns text language plpgsql security definer set search_path=public,auth as $$
declare target_id uuid;
begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  select id into target_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if target_id is null then raise exception 'User not found'; end if;
  insert into public.profiles(id,role) values(target_id,'admin')
  on conflict(id) do update set role='admin';
  return 'User promoted to admin.';
end $$;
grant execute on function public.vexa_promote_user_by_email(text) to authenticated;

-- ============================================================
-- STORAGE SECURITY
-- ============================================================
-- Public media buckets make published media directly viewable. Database/RLS
-- still controls who can create/edit the associated content records.
insert into storage.buckets (id,name,public) values
  ('videos','videos',true),
  ('photos','photos',true),
  ('thumbnails','thumbnails',true),
  ('site-assets','site-assets',true)
on conflict (id) do update set public=excluded.public;

-- Public read for media used by published content.
drop policy if exists "vexa_public_read_videos" on storage.objects;
create policy "vexa_public_read_videos" on storage.objects for select using (bucket_id='videos');
drop policy if exists "vexa_public_read_photos" on storage.objects;
create policy "vexa_public_read_photos" on storage.objects for select using (bucket_id='photos');
drop policy if exists "vexa_public_read_thumbnails" on storage.objects;
create policy "vexa_public_read_thumbnails" on storage.objects for select using (bucket_id='thumbnails');
drop policy if exists "vexa_public_read_site_assets" on storage.objects;
create policy "vexa_public_read_site_assets" on storage.objects for select using (bucket_id='site-assets');

-- Users may upload into their own folder. Admins may upload/manage all objects.
drop policy if exists "vexa_user_insert_media" on storage.objects;
create policy "vexa_user_insert_media" on storage.objects for insert to authenticated
with check (bucket_id in ('videos','photos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "vexa_admin_all_media" on storage.objects;
create policy "vexa_admin_all_media" on storage.objects for all to authenticated
using (public.is_vexa_admin() and bucket_id in ('videos','photos','thumbnails','site-assets'))
with check (public.is_vexa_admin() and bucket_id in ('videos','photos','thumbnails','site-assets'));
drop policy if exists "vexa_user_update_media" on storage.objects;
create policy "vexa_user_update_media" on storage.objects for update to authenticated
using (bucket_id in ('videos','photos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id in ('videos','photos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "vexa_user_delete_media" on storage.objects;
create policy "vexa_user_delete_media" on storage.objects for delete to authenticated
using (bucket_id in ('videos','photos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text);

-- ============================================================
-- SAVED VIDEOS
-- ============================================================
create table if not exists public.saved_videos (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id bigint not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
alter table public.saved_videos enable row level security;
drop policy if exists "saved_videos_own" on public.saved_videos;
create policy "saved_videos_own" on public.saved_videos for all to authenticated
using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ============================================================
-- USER PREFERENCES (theme + language)
-- ============================================================
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check(theme in ('dark','light')),
  language text not null default 'EN' check(language in ('EN','FR','ES')),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own" on public.user_preferences for select to authenticated using(auth.uid()=user_id);
drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own" on public.user_preferences for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own" on public.user_preferences for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

-- Ensure guest comments remain anonymous and moderated, while registered comments use their profile username in the UI.
alter table public.video_comments alter column user_id drop not null;
drop policy if exists "comments_insert_guest" on public.video_comments;
create policy "comments_insert_guest" on public.video_comments for insert to anon, authenticated
with check(user_id is null and length(trim(coalesce(guest_name,''))) between 1 and 80 and status='pending');


-- ============================================================
-- V4 CREATOR PROFILES + APPLICATIONS
-- ============================================================
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists creator_verified boolean not null default false;

-- Public creator-facing profile view. Sensitive account fields such as email and admin role
-- are deliberately excluded.
drop view if exists public.vexa_public_profiles;
create or replace view public.vexa_public_profiles as
select id, username, display_name, is_creator, country, avatar_url, banner_url, creator_verified
from public.profiles;
grant select on public.vexa_public_profiles to anon, authenticated;

create table if not exists public.creator_applications (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  country text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.creator_applications enable row level security;
drop policy if exists "creator_applications_select_own_or_admin" on public.creator_applications;
create policy "creator_applications_select_own_or_admin" on public.creator_applications
for select using (auth.uid()=user_id or public.is_vexa_admin());
drop policy if exists "creator_applications_insert_own" on public.creator_applications;
create policy "creator_applications_insert_own" on public.creator_applications
for insert to authenticated with check (auth.uid()=user_id and not public.is_vexa_creator());
drop policy if exists "creator_applications_update_admin" on public.creator_applications;
create policy "creator_applications_update_admin" on public.creator_applications
for update to authenticated using (public.is_vexa_admin()) with check (public.is_vexa_admin());

create or replace function public.vexa_apply_creator(p_country text,p_reason text)
returns text language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if public.is_vexa_creator() then return 'Your account already has creator access.'; end if;
  if exists(select 1 from public.creator_applications where user_id=auth.uid() and status='pending') then
    return 'Your creator application is already pending review.';
  end if;
  if length(trim(coalesce(p_country,'')))=0 then raise exception 'Country is required'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Please tell us why you want creator access'; end if;
  insert into public.creator_applications(user_id,country,reason,status) values(auth.uid(),trim(p_country),trim(p_reason),'pending');
  update public.profiles set country=trim(p_country) where id=auth.uid();
  return 'Application submitted for review.';
end $$;
grant execute on function public.vexa_apply_creator(text,text) to authenticated;

create or replace function public.vexa_review_creator_application(p_application_id bigint,p_status text)
returns text language plpgsql security definer set search_path=public as $$
declare target_id uuid; app_country text;
begin
  if not public.is_vexa_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'Invalid application status'; end if;
  select user_id,country into target_id,app_country from public.creator_applications where id=p_application_id;
  if target_id is null then raise exception 'Application not found'; end if;
  update public.creator_applications set status=p_status,reviewed_at=case when p_status='pending' then null else now() end,reviewed_by=case when p_status='pending' then null else auth.uid() end where id=p_application_id;
  if p_status='approved' then
    update public.profiles set is_creator=true,country=coalesce(nullif(trim(app_country),''),country) where id=target_id;
  end if;
  return case when p_status='approved' then 'Creator application approved.' when p_status='rejected' then 'Creator application rejected.' else 'Creator application returned to pending.' end;
end $$;
grant execute on function public.vexa_review_creator_application(bigint,text) to authenticated;

-- VEXA SCALE INDEXES: keep listing/search/pagination fast as content grows well beyond 500,000 rows.
create index if not exists videos_published_created_idx on public.videos(status, created_at desc, id desc);
create index if not exists videos_uploader_created_idx on public.videos(uploader_id, created_at desc, id desc);
create index if not exists photos_published_created_idx on public.photos(status, created_at desc, id desc);
create index if not exists photos_uploader_created_idx on public.photos(uploader_id, created_at desc, id desc);
create index if not exists saved_videos_user_created_idx on public.saved_videos(user_id, created_at desc, video_id);
create index if not exists creator_followers_follower_created_idx on public.creator_followers(follower_id, created_at desc, creator_id);
