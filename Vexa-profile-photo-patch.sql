-- Vexa profile/photo correction patch for an existing v10 database.
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists social_link text;
drop view if exists public.vexa_public_profiles;
create or replace view public.vexa_public_profiles as
select id, username, display_name, is_creator, country, avatar_url, banner_url,
       creator_verified, bio, social_link
from public.profiles;
grant select on public.vexa_public_profiles to anon, authenticated;
create or replace function public.vexa_following_count(p_user_id uuid)
returns bigint language sql stable security definer set search_path=public
as $$ select count(*) from public.creator_followers where follower_id=p_user_id $$;
grant execute on function public.vexa_following_count(uuid) to anon, authenticated;
insert into storage.buckets (id,name,public) values ('profile-assets','profile-assets',true) on conflict (id) do update set public=true;
drop policy if exists "vexa_profile_assets_public_read" on storage.objects;
create policy "vexa_profile_assets_public_read" on storage.objects for select using (bucket_id='profile-assets');
drop policy if exists "vexa_profile_assets_insert_own" on storage.objects;
create policy "vexa_profile_assets_insert_own" on storage.objects for insert to authenticated with check (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "vexa_profile_assets_update_own" on storage.objects;
create policy "vexa_profile_assets_update_own" on storage.objects for update to authenticated using (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "vexa_profile_assets_delete_own" on storage.objects;
create policy "vexa_profile_assets_delete_own" on storage.objects for delete to authenticated using (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.vexa_ensure_profile()
returns public.profiles
language plpgsql security definer set search_path=public
as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  insert into public.profiles(id,username,display_name,role)
  values(auth.uid(),auth.jwt()->'user_metadata'->>'username',coalesce(auth.jwt()->'user_metadata'->>'display_name',auth.jwt()->>'email'),'user')
  on conflict(id) do nothing;
  select * into result from public.profiles where id=auth.uid();
  return result;
end $$;
grant execute on function public.vexa_ensure_profile() to authenticated;
