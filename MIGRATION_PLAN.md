# KisanSync — Supabase Migration Plan

**Status:** APPROVED and IMPLEMENTED (all phases; SMS client-local; denormalized appointment columns). Verified via typecheck, production build, and a live browser smoke test.
**Guiding rules honored:** no UI redesign, no workflow rewrite, engine stays client-side and
Supabase-free, UI components stay Supabase-free, LocalStorage is not removed.

---

## 1. What I inspected

`lib/types.ts`, `lib/constants.ts`, `lib/mockData.ts`, `context/AppStateContext.tsx`,
`lib/supabase.ts`, `supabase/schema.sql` — plus a repo-wide check confirming:

- `lib/recommendationEngine.ts` imports only `constants`, `waitTime`, and types.
  It is already a pure function of `(Centre[], ProcurementRequest, ...)`. ✅
- `lib/supabase.ts` is **imported nowhere** today. The entire migration can therefore
  happen inside the data layer without touching the engine or any UI component. ✅

---

## 2. TS model ↔ SQL schema comparison

| Entity | TypeScript (`lib/types.ts`) | SQL (`supabase/schema.sql`) | Verdict |
|---|---|---|---|
| **Centre** | `id`, `name`, `distanceKm`, `queueCount`, `processingRatePerHour`, `capacityPerDay`, `bookedToday`, `eligibleCrops[]`, `location`, `opensAt`, `closesAt` | `centres(id, name, location, distance_km, capacity_per_day, processing_rate_per_hour, eligible_crops text[], opens_at, closes_at)` | ⚠️ Mismatch: SQL has **no `queue_count` or `booked_today`** columns. The engine, load-status chip, and Congestion Simulator all depend on them. `opens_at`/`closes_at` are `time` (maps cleanly to `"HH:mm"` strings). |
| **Farmer / profile** | `Farmer { id, name, village }` + `DEMO_FARMER` constant | `profiles(id ← auth.users, role, full_name)` + `farmers(id, profile_id, village, phone)` | ⚠️ Mismatch: name lives on `profiles.full_name`; `farmers.id` is a uuid unrelated to the demo's `farmer-ramesh` string ids. Needs an id-mapping strategy (below), not a schema change. |
| **Procurement request** | `ProcurementRequest { crop, quantityQuintals, village, preferredTime }` (not currently stored anywhere) | `procurement_requests(farmer_id, crop, quantity_quintals, village, preferred_time, created_at)` | ✅ Field-for-field match once camelCase↔snake_case mapping exists. |
| **Appointment** | `id, tokenNumber, farmerId, farmerName, centreId, centreName, crop, quantityQuintals, village, arrivalWindow, bookedAt, status, stageIndex, estimatedAmountInr, paymentRef?, archived?` | `appointments(token_number, farmer_id, centre_id, request_id, arrival_window, status, booked_at)` | ⚠️ Mismatch (the big one): SQL has **no `farmer_name`, `centre_name`, `crop`, `quantity_quintals`, `village`, `stage_index`, `estimated_amount_inr`, `payment_ref`, `archived`**. The centre dashboard queue UI renders `farmerName`, `crop`, `quantityQuintals` directly off the appointment. |
| **Procurement status** | Modelled inline as `status` + `stageIndex` on `Appointment`; `TRACKING_STAGES`/`CENTRE_STATUS_FLOW` in constants | `procurement_status(appointment_id, status, changed_at)` — an event log | ⚠️ Conceptual mismatch: app keeps *current* status on the row; SQL models a *history* table. Compatible: derive current status = latest event, or keep writing the appointments row too. No change needed to the app model. |
| **Payment** | `estimatedAmountInr` + `paymentRef` inline on `Appointment`; generated at `payment_received` | `payments(appointment_id, amount_inr, payment_ref, paid_at)` | ⚠️ Split representation. Data can be mirrored into `payments` on transition without changing the app model. |
| **SMS / events** | `SmsMessage { id, createdAt(ms), kind, tokenNumber, centreName, stageKey?, arrivalWindow?, amountInr?, paymentRef? }` | **No table exists.** | ❌ Missing. If SMS must survive reload/cross-device, one `events` table is needed. If not, keep SMS LocalStorage-only (see options). |

### Schema changes required (the only genuine blockers)

Per your instruction, only what blocks persisting the existing workflow:

1. **`centres`**: add `queue_count int not null default 0` and `booked_today int not null default 0`.
   Both are live, mutable demo fields the engine consumes. (Alternative: derive
   `booked_today` by counting today's appointments and `queue_count` from open
   appointments — more truthful long-term, but it changes the congestion-simulation
   behavior. Recommend columns now, derivation as a later hardening step.)
2. **`appointments`**: add `farmer_name text`, `crop text`, `quantity_quintals numeric(6,2)`,
   `village text`, `stage_index int`, `estimated_amount_inr numeric(12,2)`,
   `payment_ref text`, `archived boolean default false` — OR (cleaner long-term) denormalize:
   keep the appointment row slim and JOIN `procurement_requests` + `farmers`/`profiles`
   on read. The slim route avoids duplicating data but changes the read path shape.
   **Recommendation: add the columns** — it preserves the current UI data shape exactly
   and keeps the demo working during the migration window.
3. **SMS** — decide: (a) new `events`/`sms_outbox` table, or (b) keep SMS client-local
   (demo parity, zero schema change). Recommend (b) for phase 1, (a) as a follow-up.

---

## 3. Architecture for the migration

```
UI components (app/, components/)        ← unchanged, consume AppStateContext only
        │
AppStateContext (context/)               ← API unchanged: centres, appointments, bookToken, ...
        │
DATA SOURCE INTERFACE (new lib/data/)    ← the seam. Two implementations:
   ├── localStorageSource (current behavior, preserved verbatim)
   └── supabaseSource (new; maps TS models ↔ snake_case rows, offline→cache fallback)
        │
lib/supabase.ts                          ← unchanged; lazily created client
```

The context keeps its exact public API and swaps the implementation behind
`isSupabaseConfigured` (with an env-var / demo-mode override so you can always run the
pure-LocalStorage demo, e.g. `NEXT_PUBLIC_DATA_SOURCE=local|supabase`).

**Engine guarantee:** `calculateCentreRecommendation()` keeps receiving plain `Centre[]` +
`ProcurementRequest`. It never imports `@/lib/supabase`. Any Supabase row → `Centre` mapping
happens in `lib/data/supabaseSource` before the data reaches the context. Zero engine changes.

---

## 4. Phased migration

### Phase 0 — Baseline (no behavior change)
- Typecheck + build + manual smoke test to lock in the current green state.
- Add `NEXT_PUBLIC_DATA_SOURCE` env plumbing (defaults to `local`).

### Phase 1 — Supabase source, localStorage remains the fallback
- New `lib/data/types.ts` — the `DataSource` interface: `loadState()`, `bookToken()`,
  `updateStatus()`, `surgeQueue()`, `archive()`, `resetDemoData()` (each returning
  canonical TS shapes; all camelCase↔snake_case mapping inside the source).
- New `lib/data/localStorageSource.ts` — extract the existing localStorage logic from
  `AppStateContext.tsx` unchanged.
- New `lib/data/supabaseSource.ts` — implement the same interface against
  `centres`, `procurement_requests`, `appointments`, `procurement_status`, `payments`.
  Writes go to `procurement_status` (event log) and `payments` mirroring the inline fields.
- `context/AppStateContext.tsx` — switch to a `DataSource` chosen at module load;
  hydrate on mount; keep optimistic in-memory updates so the UI stays snappy.
  Keep the `storage`-event listener active when running on localStorage only.
- `supabase/schema.sql` — apply the Phase-2 column additions (centres queue/booked,
  appointments denormalized fields). **Only because they are genuine blockers.**
- Seed script or SQL insert for the 3 mock centres + demo farmer so the Supabase demo
  starts with the same data.
- localStorage remains for: language, role, offline centre cache, and as the demo-mode
  state store. Nothing removed.

### Phase 2 — Shared farmer + centre state (two-window demo over the network)
- Realtime subscriptions (`supabase-js` `postgres_changes` on `centres`, `appointments`,
  `procurement_status`) replace the cross-tab `storage` events when on Supabase.
- Optimistic updates + reconciliation; queue surge writes `queue_count` to the row so the
  other window sees congestion live.
- Online/offline: same `usingCachedData` banner semantics — offline falls back to
  `kisansync_cached_centres` snapshot; writes queue locally and replay on reconnect.

### Phase 3 — Cleanup (explicitly later, not now)
- Remove seed appointments from localStorage once Supabase seeding is trusted.
- Consider deriving `booked_today`/`queue_count` from appointments instead of columns.
- Harden RLS policies beyond "demo read/write all".

---

## 5. Exact files to modify

**Modified (4):**
| File | Change |
|---|---|
| `context/AppStateContext.tsx` | Delegate persistence to a `DataSource`; keep the public API identical; realtime/`storage`-event subscriptions move behind the same seam. |
| `supabase/schema.sql` | Add the two `centres` columns + nine `appointments` columns listed above (+ optional `sms_outbox` table if you choose option (a)). |
| `lib/constants.ts` | Add `NEXT_PUBLIC_DATA_SOURCE` handling / data-mode flag next to `STORAGE_KEYS`. |
| `.env.local.example` (new) | Document `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DATA_SOURCE`. |

**New (4):**
| File | Purpose |
|---|---|
| `lib/data/types.ts` | `DataSource` interface + shared camel↔snake mappers. |
| `lib/data/localStorageSource.ts` | Current persistence logic, extracted verbatim. |
| `lib/data/supabaseSource.ts` | Supabase implementation of `DataSource`. |
| `supabase/seed.sql` | 3 mock centres + demo farmer + seed appointments, matching `lib/mockData.ts`. |

**Explicitly NOT modified:**
`lib/recommendationEngine.ts`, `lib/types.ts`, `lib/mockData.ts`, `lib/waitTime.ts`,
`lib/supabase.ts`, `lib/translations.ts`, all of `app/` and `components/` — engine stays
pure, UI stays Supabase-free.

---

## 6. Risks & open decisions

1. **SMS persistence** — new table (option a) vs client-local (option b)? Recommend (b) in phase 1.
2. **Denormalized appointment columns** vs JOIN-on-read: recommend columns now (exact UI-shape
   preservation), refactor later if desired.
3. **Auth** — schema assumes `auth.users`; the demo has no auth. Anon key + open RLS works
   for the demo; real policies are a later concern. If you want real farmer identity, that is
   a bigger change than this plan covers.
4. **No test framework** — I'd add Vitest unit tests around `lib/data/*` mappers before
   flipping the default to Supabase, since a mapping bug silently corrupts demo state.
