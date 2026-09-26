-- KisanSync — seed data matching lib/mockData.ts.
-- Run AFTER supabase/schema.sql. Idempotent (upserts); safe to re-run.
-- Delete `kisansync` demo rows and re-run for a full demo reset.

begin;

-- Demo farmer (id matches DEMO_FARMER.id / DEMO_FARMER_PROFILE).
insert into public.farmers (id, village)
values ('farmer-ramesh', 'Belvai, Moodbidri Taluk')
on conflict (id) do update set village = excluded.village;

-- Centres: same ids and values as MOCK_CENTRES.
insert into public.centres (
  id, name, location, distance_km, queue_count, booked_today,
  capacity_per_day, processing_rate_per_hour, eligible_crops, opens_at, closes_at
) values
  ('centre-moodbidri', 'Moodbidri APMC', 'Moodbidri', 8.0,
   14, 68, 100, 6.0,
   array['Paddy / Rice', 'Maize', 'Coconut', 'Groundnut', 'Black Gram', 'Green Gram'],
   '08:00', '19:00'),
  ('centre-karkala', 'Karkala Co-op', 'Karkala', 18.0,
   4, 22, 60, 5.0,
   array['Paddy / Rice', 'Maize', 'Coconut', 'Arecanut', 'Black Gram', 'Green Gram'],
   '08:30', '18:00'),
  ('centre-belvai', 'Belvai Agro Hub', 'Belvai', 4.0,
   21, 36, 40, 4.0,
   array['Paddy / Rice', 'Chilli', 'Tomato', 'Potato', 'Black Gram', 'Green Gram'],
   '09:00', '17:00')
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  distance_km = excluded.distance_km,
  queue_count = excluded.queue_count,
  booked_today = excluded.booked_today,
  capacity_per_day = excluded.capacity_per_day,
  processing_rate_per_hour = excluded.processing_rate_per_hour,
  eligible_crops = excluded.eligible_crops,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at;

-- Seed appointments for the centre dashboard queue (ids match lib/mockData.ts).
-- Tokens KS-101..KS-107 (no KS-104 — that is the demo farmer's first booking).
insert into public.appointments (
  id, token_number, farmer_id, farmer_name, centre_id, centre_name,
  crop, quantity_quintals, village, arrival_window, status, stage_index,
  estimated_amount_inr, booked_at
) values
  ('apt-ks-101', 'KS-101', 'farmer-ks-101', 'Lakshmi Rai', 'centre-moodbidri', 'Moodbidri APMC',
   'Paddy / Rice', 12, 'Moodbidri Taluk', '10:00 AM – 10:20 AM', 'slot_booked', 0,
   12 * 2300, now() - interval '3 hours'),
  ('apt-ks-102', 'KS-102', 'farmer-ks-102', 'Suresh Shetty', 'centre-moodbidri', 'Moodbidri APMC',
   'Coconut', 8, 'Moodbidri Taluk', '10:00 AM – 10:20 AM', 'arrived', 1,
   8 * 1800, now() - interval '3 hours'),
  ('apt-ks-103', 'KS-103', 'farmer-ks-103', 'Ganesh Poojary', 'centre-moodbidri', 'Moodbidri APMC',
   'Paddy / Rice', 20, 'Moodbidri Taluk', '10:00 AM – 10:20 AM', 'weighed', 2,
   20 * 2300, now() - interval '3 hours'),
  ('apt-ks-105', 'KS-105', 'farmer-ks-105', 'Vasanth Alva', 'centre-karkala', 'Karkala Co-op',
   'Arecanut', 6, 'Moodbidri Taluk', '10:00 AM – 10:20 AM', 'slot_booked', 0,
   6 * 3200, now() - interval '3 hours'),
  ('apt-ks-106', 'KS-106', 'farmer-ks-106', 'Prakash Nayak', 'centre-karkala', 'Karkala Co-op',
   'Paddy / Rice', 15, 'Moodbidri Taluk', '10:00 AM – 10:20 AM', 'slot_booked', 0,
   15 * 2300, now() - interval '3 hours'),
  ('apt-ks-107', 'KS-107', 'farmer-ks-107', 'Ravi Shetty', 'centre-belvai', 'Belvai Agro Hub',
   'Chilli', 10, 'Moodbidri Taluk', '10:00 AM – 10:20 AM', 'slot_booked', 0,
   10 * 3500, now() - interval '3 hours')
on conflict (token_number) do update set
  farmer_name = excluded.farmer_name,
  status = excluded.status,
  stage_index = excluded.stage_index,
  estimated_amount_inr = excluded.estimated_amount_inr;

-- Initial status-history events for the seed appointments.
insert into public.procurement_status (appointment_id, status)
select id, status from public.appointments
where id like 'apt-ks-1%' and id not in (
  select appointment_id from public.procurement_status
);

commit;
