-- MEDIA HUB HUTECH: chạy toàn bộ SQL này trong Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('admin','editor','organizer','student')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.has_content_role()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','editor','organizer')
  );
$$;

create or replace function public.has_admin_role()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create table if not exists public.events (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 slug text not null unique,
 summary text,
 content text,
 category text default 'Workshop',
 cover_image text,
 image_urls text[] not null default '{}',
 event_date date,
 start_time text,
 location text,
 registration_url text,
 status text not null default 'draft' check (status in ('draft','published')),
 created_by uuid references auth.users(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 slug text not null unique,
 summary text,
 content text,
 category text default 'Tin tức',
 cover_image text,
 image_urls text[] not null default '{}',
 event_date date,
 start_time text,
 location text,
 registration_url text,
 status text not null default 'draft' check (status in ('draft','published')),
 created_by uuid references auth.users(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.posts enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
using (id=auth.uid() or public.has_admin_role());
drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update to authenticated
using (public.has_admin_role()) with check (public.has_admin_role());

do $$ declare t text; begin
 foreach t in array array['events','posts'] loop
  execute format('drop policy if exists "public read published %I" on public.%I',t,t);
  execute format('create policy "public read published %I" on public.%I for select to anon, authenticated using (status = ''published'' or public.has_content_role())',t,t);
  execute format('drop policy if exists "content role insert %I" on public.%I',t,t);
  execute format('create policy "content role insert %I" on public.%I for insert to authenticated with check (public.has_content_role())',t,t);
  execute format('drop policy if exists "content role update %I" on public.%I',t,t);
  execute format('create policy "content role update %I" on public.%I for update to authenticated using (public.has_content_role()) with check (public.has_content_role())',t,t);
  execute format('drop policy if exists "content role delete %I" on public.%I',t,t);
  execute format('create policy "content role delete %I" on public.%I for delete to authenticated using (public.has_content_role())',t,t);
 end loop;
end $$;

-- Bucket công khai để trình duyệt hiển thị ảnh đã đăng.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('media','media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true, file_size_limit=10485760,
 allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "public view media" on storage.objects;
create policy "public view media" on storage.objects for select to anon, authenticated using (bucket_id='media');
drop policy if exists "content roles upload media" on storage.objects;
create policy "content roles upload media" on storage.objects for insert to authenticated
with check (bucket_id='media' and public.has_content_role());
drop policy if exists "content roles update media" on storage.objects;
create policy "content roles update media" on storage.objects for update to authenticated
using (bucket_id='media' and public.has_content_role()) with check (bucket_id='media' and public.has_content_role());
drop policy if exists "content roles delete media" on storage.objects;
create policy "content roles delete media" on storage.objects for delete to authenticated
using (bucket_id='media' and public.has_content_role());

-- Sau khi tạo tài khoản đầu tiên trong Supabase Authentication > Users,
-- thay EMAIL_ADMIN bằng email thật của tài khoản rồi chạy:
-- update public.profiles p set role='admin'
-- from auth.users u where p.id=u.id and u.email='EMAIL_ADMIN';
