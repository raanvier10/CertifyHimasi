-- =============================================================================
-- CertifyNow - HIMASI UBSI Karawang Database Schema
-- Supabase PostgreSQL Setup Script (Updated with Storage & Role Grants)
-- =============================================================================

-- 1. BERIKAN HAK AKSES DASAR SCHEMA KE ROLE SUPABASE
grant usage on schema public to postgres, anon, authenticated, service_role;

-- 2. TABEL ACARA / EVENTS
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date text,
  template_url text,
  positions jsonb default '{"name": {"x": 148, "y": 105, "size": 32}, "role": {"x": 148, "y": 132, "size": 18}, "color": "#1E255E"}'::jsonb,
  created_at timestamptz default now()
);

-- 3. TABEL DATA PESERTA / PARTICIPANTS
create table if not exists public.participants (
  id uuid default gen_random_uuid() primary key,
  nama text not null,
  peran text not null default 'Peserta',
  event_id uuid references public.events(id) on delete cascade,
  event_name text,
  download_count int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_participants_nama on public.participants(nama);
create index if not exists idx_participants_event_id on public.participants(event_id);

-- 4. TABEL RIWAYAT PENGUNDUHAN / DOWNLOADS
create table if not exists public.downloads (
  id uuid default gen_random_uuid() primary key,
  participant_id uuid,
  participant_name text,
  peran text,
  event_id uuid,
  event_name text,
  download_date timestamptz default now()
);

create index if not exists idx_downloads_event_id on public.downloads(event_id);
create index if not exists idx_downloads_participant_name on public.downloads(participant_name);

-- 5. RPC: FUNGSI ATOMIK INCREMENT UNDUHAN
create or replace function public.increment_download(row_id uuid)
returns void as $$
begin
  update public.participants
  set download_count = coalesce(download_count, 0) + 1
  where id = row_id;
end;
$$ language plpgsql security definer;

-- 6. BERIKAN HAK AKSES TABEL & FUNGSI UNTUK SEMUA ROLE
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.downloads enable row level security;

-- Policies Events
drop policy if exists "Allow public read events" on public.events;
create policy "Allow public read events" on public.events for select using (true);

drop policy if exists "Allow all actions for events" on public.events;
create policy "Allow all actions for events" on public.events for all using (true);

-- Policies Participants
drop policy if exists "Allow public read participants" on public.participants;
create policy "Allow public read participants" on public.participants for select using (true);

drop policy if exists "Allow all actions for participants" on public.participants;
create policy "Allow all actions for participants" on public.participants for all using (true);

-- Policies Downloads
drop policy if exists "Allow public read downloads" on public.downloads;
create policy "Allow public read downloads" on public.downloads for select using (true);

drop policy if exists "Allow all actions for downloads" on public.downloads;
create policy "Allow all actions for downloads" on public.downloads for all using (true);

-- =============================================================================
-- 8. STORAGE BUCKET 'certificates' & POLICIES (OTOMATIS)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do update set public = true;

-- Policy Storage: Baca publik
drop policy if exists "Public Access for Certificates" on storage.objects;
create policy "Public Access for Certificates"
on storage.objects for select
using (bucket_id = 'certificates');

-- Policy Storage: Unggah (Insert)
drop policy if exists "Allow upload to Certificates" on storage.objects;
create policy "Allow upload to Certificates"
on storage.objects for insert
with check (bucket_id = 'certificates');

-- Policy Storage: Perbarui (Update)
drop policy if exists "Allow update to Certificates" on storage.objects;
create policy "Allow update to Certificates"
on storage.objects for update
using (bucket_id = 'certificates');

-- Policy Storage: Hapus (Delete)
drop policy if exists "Allow delete to Certificates" on storage.objects;
create policy "Allow delete to Certificates"
on storage.objects for delete
using (bucket_id = 'certificates');
