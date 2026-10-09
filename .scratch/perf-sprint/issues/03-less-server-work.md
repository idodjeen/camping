# P03: Less server work per request

**What to build:** Every trip API call reads the person and their access to the trip in one query instead
of two, and every endpoint runs its independent queries together instead of one after another. The
dashboard counts in SQL instead of loading three whole lists.

**Blocked by:** P02

**Status:** ready-for-agent

**Files touched:** `src/lib/access.ts`, `src/lib/session.ts`, `src/lib/user.ts`, `src/lib/queries.ts`,
`src/lib/weather.ts`, `src/lib/notifications.ts`, `src/app/api/t/[tripId]/me/route.ts`,
`src/app/api/t/[tripId]/dashboard/route.ts`, `src/app/api/t/[tripId]/weather/route.ts`.

- [ ] `requireTrip` reads the person (with the Gmail spelling rule) and their access in one query, and keeps 401 before 404 before 403 exactly as now
- [ ] `/me` runs claims, the personal list, the trip's people and the legacy `unreadMentions` together; the legacy field stays until H
- [ ] `getGear`, `getShopping` and `getMeals` run their three queries together
- [ ] `/dashboard` computes its progress counts and its waiting list in SQL; its response matches the old code's for every trip on `dev`
- [ ] `/weather` uses the trip `requireTrip` already loaded
- [ ] Every changed endpoint returns the same JSON as before for a test trip
- [ ] (The header's `/me` poll went in P02.)
- [ ] Done per the spec's definition of done

## Measured before and after

Sequential database round trips per request, counted from the code on 2026-10-09, and times measured
locally against `dev` (about 140 ms per round trip from Israel). Filled in by the PR.

| Endpoint | Round trips before | After | Local time before | After |
|---|---|---|---|---|
| Any trip route: the person, then the access | 2 | | | |
| `/me` | 6 | | | |
| `/gear`, `/shopping`, `/meals` | 5 | | | |
| `/dashboard` | 4 | | | |
| `/inbox` | 4 | | | |
| `/weather` | 3, plus Open-Meteo (cached 1 h) | | | |

**Then stop:** measure P01-P03 together (see the spec) and report the numbers to Ido before P04.
