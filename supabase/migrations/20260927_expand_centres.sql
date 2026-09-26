-- Migration: Add metadata columns and spatial indexes to public.centres
alter table public.centres
  add column if not exists canonical_name text,
  add column if not exists state text,
  add column if not exists district text,
  add column if not exists subdistrict text,
  add column if not exists source text,
  add column if not exists external_id text,
  add column if not exists centre_type text default 'apmc_mandi',
  add column if not exists address text,
  add column if not exists active boolean not null default true;

create index if not exists idx_centres_coords on public.centres (latitude, longitude);
create index if not exists idx_centres_state_district on public.centres (state, district);
create index if not exists idx_centres_active on public.centres (active);
