-- KisanSync — reference Supabase schema.
-- The MVP runs on mock data; these tables are the migration path.
-- Run in the Supabase SQL editor if you want to back the demo with a real DB.

-- Roles: farmer | centre_staff
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('farmer', 'centre_staff')),
  full_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.farmers (
  -- text id so the demo's farmer-ramesh ids persist as-is; real auth users
  -- can later claim these rows via profiles.profile_id.
  id text primary key,
  profile_id uuid references public.profiles(id),
  village text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.centres (
  -- text id so demo seed ids (centre-moodbidri, ...) persist as-is.
  id text primary key,
  name text not null,
  location text not null,
  distance_km numeric(5,1) not null,
  capacity_per_day int not null,
  processing_rate_per_hour numeric(4,1) not null,
  -- Live operational fields consumed by the client-side coordination engine
  -- (genuine blockers: engine + load-status chip + congestion simulator).
  queue_count int not null default 0,
  booked_today int not null default 0,
  eligible_crops text[] not null default '{}',
  opens_at time not null default '08:00',
  closes_at time not null default '19:00',
  created_at timestamptz not null default now()
);

create table if not exists public.procurement_requests (
  id uuid primary key default gen_random_uuid(),
  farmer_id text not null references public.farmers(id),
  crop text not null,
  quantity_quintals numeric(6,2) not null,
  village text not null,
  preferred_time text not null check (preferred_time in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  -- Client-generated text id (e.g. apt-ks-108-...). Keeps the optimistic UI
  -- id identical to the DB id so realtime updates match in-flight state.
  id text primary key,
  token_number text not null unique,
  farmer_id text not null references public.farmers(id),
  centre_id text not null references public.centres(id),
  request_id uuid references public.procurement_requests(id),
  -- Denormalized display fields (approved decision): preserves the exact
  -- TS Appointment shape so the centre queue renders without joins.
  farmer_name text not null default '',
  crop text not null default '',
  quantity_quintals numeric(6,2) not null default 0,
  village text not null default '',
  stage_index int not null default 0,
  estimated_amount_inr numeric(12,2) not null default 0,
  payment_ref text,
  archived boolean not null default false,
  arrival_window text not null,
  status text not null default 'slot_booked' check (status in (
    'slot_booked', 'arrived', 'weighed', 'quality_verified',
    'procurement_completed', 'payment_initiated', 'payment_received', 'cancelled'
  )),
  booked_at timestamptz not null default now()
);

create table if not exists public.procurement_status (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null references public.appointments(id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null references public.appointments(id) on delete cascade,
  amount_inr numeric(12,2) not null,
  payment_ref text,
  paid_at timestamptz
);

-- Simple demo-friendly RLS: allow the anon key to work for the prototype.
-- Tighten with real policies before any production use.
alter table public.profiles enable row level security;
alter table public.farmers enable row level security;
alter table public.centres enable row level security;
alter table public.procurement_requests enable row level security;
alter table public.appointments enable row level security;
alter table public.procurement_status enable row level security;
alter table public.payments enable row level security;

create policy "demo read all" on public.centres for select using (true);
create policy "demo write all" on public.centres for all using (true) with check (true);
create policy "demo appointments all" on public.appointments for all using (true) with check (true);
create policy "demo requests all" on public.procurement_requests for all using (true) with check (true);
create policy "demo status all" on public.procurement_status for all using (true) with check (true);
create policy "demo payments all" on public.payments for all using (true) with check (true);
create policy "demo farmers all" on public.farmers for all using (true) with check (true);
create policy "demo profiles read" on public.profiles for select using (true);
