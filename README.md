# 🌾 KisanSync

Smart agricultural procurement coordination — a 24-hour hackathon prototype.

KisanSync coordinates **farmer demand** with **procurement-centre capacity**: a transparent, rule-based engine recommends a centre + arrival window, the farmer books a token, centre staff advance the procurement stages, and the farmer tracks everything from gate to bank payment.

## Quick demo

```bash
npm install
npm run dev
```

Open http://localhost:3000

- **Farmer Dashboard** (`/dashboard`) — request form, Coordination Engine recommendation, booking, 8-stage tracker.
- **Centre Dashboard** (`/centre`) — capacity, queue, congestion simulation, status updates.
- Open the two dashboards in **two browser windows** — state syncs live via `localStorage` + `storage` events.

## Demo story (judges)

1. Farmer opens KisanSync, selects crop `Paddy Grade A`, 15 quintals.
2. The engine compares all three centres: distance, queue, wait, capacity, eligibility.
3. KisanSync recommends a centre + arrival window with a transparent score breakdown.
4. Farmer books a token (e.g. `KS-108`) — centre load updates immediately.
5. Switch to the Centre Dashboard: the appointment appears in Today's Appointments.
6. Staff press **Advance** through the stages — the farmer dashboard updates live.
7. The SMS simulator (📱 button) reflects every event in the active language.
8. Voice assist reads the recommendation aloud in English / Kannada / Hindi.
9. **Load-balancing demo:** on the centre dashboard press **Simulate Congestion** on the recommended centre — its wait rises, score drops, and the farmer dashboard now recommends a different centre.

## Coordination Engine (transparent, rule-based)

```
totalScore = distanceScore(30) + queueScore(25) + waitScore(25)
           + capacityScore(10) + eligibilityScore(20)
```

- Each factor is normalised to 0–1 against documented reference ranges, then multiplied by its weight.
- Weights live in `lib/constants.ts` (`ENGINE_WEIGHTS`) — tune them live during the demo.
- Estimated wait = `queueCount / processingRatePerHour × 60` (safe for zero/invalid rates).
- Every recommendation includes a per-factor breakdown and a plain-language explanation.

No AI/ML — every point is traceable.

## Multilingual + voice + offline

- English / ಕನ್ನಡ / हिंदी via `lib/translations.ts` + `context/LanguageContext.tsx` (persisted in localStorage).
- Voice via Web Speech API (`en-IN`, `kn-IN`, `hi-IN`), generated from the live recommendation.
- Centre data cached in `localStorage` under `kisansync_cached_centres`; the header Online/Offline chip simulates offline mode and shows **"Offline Mode: Showing Last Synced Hub Data"**.

## Project structure

```
app/            # landing, farmer dashboard, centre dashboard (App Router)
components/     # CentreCard, RecommendationCard, BookingModal, TrackingStepper,
                # SmsSimulatorDrawer, VoiceAssistButton, StatusBadge, AppHeader
context/        # LanguageContext, AppStateContext (shared demo state)
lib/            # types, constants, recommendationEngine, waitTime, mockData,
                # translations, supabase (optional client)
supabase/       # schema.sql — reference tables for the real backend
```

## Supabase

The prototype works fully without credentials. To connect a real backend:

1. Create a Supabase project and run `supabase/schema.sql`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Swap the persistence in `AppStateContext` for table reads/writes — the UI does not change.

## Notes

- All operational data (queues, rates, capacity) is **simulated** for the demo — not a real-time prediction model.
- The SMS simulator is a UI simulation; no SMS provider is integrated.
- Deployment: `vercel deploy` — standard Next.js build.
