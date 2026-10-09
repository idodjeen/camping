# P03: Less server work per request

**What to build:** Every trip API call reads the person and their access to the trip in one query instead
of two, and every endpoint runs its independent queries together instead of one after another. The
dashboard counts in SQL instead of loading three whole lists.

**Blocked by:** P02

**Status:** done 2026-10-10 (#35)

**Files touched:** `src/lib/access.ts`, `src/lib/session.ts`, `src/lib/user.ts`, `src/lib/queries.ts`,
`src/lib/weather.ts`, `src/lib/emails.ts` (passes its trip to the forecast), `src/app/api/t/[tripId]/me/route.ts`,
`src/app/api/t/[tripId]/dashboard/route.ts`, `src/app/api/t/[tripId]/weather/route.ts`, `docs/handoff.md`,
`docs/architecture.md`. Not `src/lib/notifications.ts`: `/inbox` already ran its reads together.

- [x] `requireTrip` reads the person (with the Gmail spelling rule) and their access in one query, and keeps 401 before 404 before 403 exactly as now
- [x] `/me` runs claims, the personal list, the trip's people and the legacy `unreadMentions` together; the legacy field stays until H
- [x] `getGear`, `getShopping` and `getMeals` run their three queries together
- [x] `/dashboard` computes its progress counts and its waiting list in SQL; its response matches the old code's for every trip on `dev`
- [x] `/weather` uses the trip `requireTrip` already loaded
- [x] Every changed endpoint returns the same JSON as before for a test trip
- [x] (The header's `/me` poll went in P02.)
- [ ] Done per the spec's definition of done (Ido's preview check)

## Measured before and after

Times measured locally (`next dev` of this branch and of its base, 2026-10-10) against `dev` from Israel,
where one database round trip took 157 ms (median of `select 1`). One warm-up, then 9 requests, the
median. The test trip: a template trip with claims, bought items, personal items, unread tags and four
meals.

| Endpoint | Round trips before | After | Local time before | After |
|---|---|---|---|---|
| Any trip route: the person, then the access | 2 | 1 | | |
| `/me` | 6 | 2 | 1050 ms | 366 ms |
| `/gear`, `/shopping`, `/meals` | 5 | 2 | 900 ms | 356-364 ms |
| `/dashboard` | 4 | 2 | 672 ms | 353 ms |
| `/inbox` | 4 | 3 | 684 ms | 524 ms |
| `/weather` | 3, plus Open-Meteo (cached 1 h) | 1, plus Open-Meteo | 525 ms | 159 ms |
| Every other trip route (`/chat`, `/expenses`, writes) | | one less | `/chat` 686, `/expenses` 524 ms | 526, 349 ms |

`/inbox` keeps one round trip after its rows: the item names in the bell depend on which rows came back.

**Same answers.** Every changed read endpoint returned byte-identical JSON (keys sorted) before and after,
for both trips on `dev` (14 responses, one trip read as a super admin from outside its group). The old
dashboard logic and the new SQL gave identical JSON, key order included, for both trips at 8 clock times
(before the trip, exactly at a meal's hour, a minute after, between meals, after the last). 20 gate cases
(unknown email, a person in no group, another group's trip, missing and malformed ids, a viewer and an
editor off the trip writing, an admin route, Gmail spelled differently) gave the same status and body,
with one intended change: an id beyond the `serial` range (`/api/t/99999999999/...`) was a 500 and is
now the same 404 as any missing trip.

**On production** the functions and the database sit in the same region, so one round trip is a few ms,
not 157: this saves a few ms of waiting per request there, plus loading the dashboard's three whole
lists. The local numbers make the round trips visible; they are not what a camper gains.

**Then stop:** measure P01-P03 together (see the spec) and report the numbers to Ido before P04.
