# Groups phase 5: design so far (handoff, 2026-10-08)

> Branch `claude/admin-group` (the name docs/roadmap.md gives phase 5), cut from `main` at 8bba31f.
> Read `docs/handoff.md` first for the rules, testing setup and open items; this file only covers
> phase 5. Delete it in the phase 5 PR once its content is in the PR description.

## Done on this branch

- `findActiveUser(email)` in `src/lib/user.ts`: the user row, but only while they're the super admin
  or in at least one group (one query with an `exists`).
- `getCurrentUser()` and `requirePageUser()` in `src/lib/session.ts` use it. So someone removed from
  their last group stops counting as signed in on the next request, despite a 30-day session: the API
  answers 401 and pages go to `/no-access`. `auth.ts`'s `jwt` callback still uses `findUserByEmail`.
- Typecheck passes. Nothing else is built yet. No migration is needed for phase 5.

## Decisions (made from the plan's Defaults and roadmap section 10; none waits on Ido)

**Gate.** Add to `src/lib/access.ts`, next to `requireTrip`:
`loadGroupAccess(user, groupId)` and `requireGroupAdmin(groupId)`. 404 for anyone outside the group
(the super admin passes everywhere), 403 for members who aren't admins. Every `/g/...` page and
`/api/g/...` route starts with it.

**Members.**
- Add from a pasted list (reuse `parsePeople`, the `PeopleField` UI from `src/components/admin-groups.tsx`,
  which needs exporting) as editors or viewers. New people via `createUser(tx, ...)`; existing people
  keep their stored name. Already a member: rejected. Name uniqueness runs on effective names across
  the whole group (existing members included), re-checked inside the transaction, as `createGroup()` does.
- Change role: admin, editor, viewer. Remove: allowed.
- No lock-outs: nobody removes themselves; the last admin can't be demoted or removed. Lock the
  group's admin rows (`for update`) in the transaction so two admins demoting each other can't race.
- Show the invite message (`inviteMessage`) after adding people.

**Trip membership follows the role.**
- Admins and editors are on every trip that hasn't ended (`end_date >= today` in Israel time);
  viewers are on none (they're read-only anyway, and being on a trip puts you in its splits).
- Promote a viewer: add them to the open trips. Demote to viewer, or remove from the group: take them
  off the group's trips and release their gear claims there.
- Blocked, with a message naming the trip, when they have money on a trip of this group: an expense
  they paid, an expense share, or a settlement either way. Balances must never lose a person.
- Per trip, the admin can still toggle someone on or off a trip (same money block) and toggle shopper.

**New trip.**
- Fields: name (up to 60), start and end date (end >= start), place name, and coordinates. `trip.lat`
  and `trip.lng` are required, so accept a pasted "32.79, 35.53" or a Google Maps link and parse
  `@lat,lng`, `q=lat,lng`, `ll=lat,lng` or `!3dlat!4dlng`. Short `maps.app.goo.gl` links can't be
  parsed without fetching: say so and ask for coordinates.
- Starts from either:
  - the template: `GEAR` and `SHOPPING` from `src/db/seed-data.ts`, names, quantities and gear notes;
    no shopping notes (they're the founders' own arrangements, such as "עידודו") and no meals;
  - or a copy of an earlier trip **in the same group**: gear and shopping categories and items (no
    claims, nothing bought, `created_by` null so nobody gets leaderboard credit) plus meals shifted by
    (new start minus old start) days, keeping only those inside the new dates, with their ingredient
    links remapped by shopping item name.
- People: every admin and editor of the group; the creator is the shopper if they're on the trip.
- After creating, open `/t/<new id>`.

**Ways in.**
- Menu: a "ניהול הקבוצה" row for group admins, linking `/g/<groupId of the current trip>`. It can't
  be a `NAV` item (per-group href), so add it as its own block in `NavMenu`
  (`src/components/app-header.tsx`); `TripOption` already carries `groupId`.
- `/admin`: each group card links to its `/g/<id>`.
- `/trips`: also list the person's groups that have no trip yet. For a group admin, a "create a
  trip" button there; otherwise "the group admin will create one". Without this, a brand-new group's
  admin has no way in (their `/trips` is empty).

**API (all behind `requireGroupAdmin`).**

| Route | Does |
|---|---|
| `GET /api/g/[groupId]` | group, members (name, email, role), trips with their people and shoppers |
| `POST /api/g/[groupId]/members` | `{ people: [{email, name}], role: "editor" \| "viewer" }` |
| `PATCH /api/g/[groupId]/members/[userId]` | `{ role }` |
| `DELETE /api/g/[groupId]/members/[userId]` | remove from the group |
| `POST /api/g/[groupId]/trips` | `{ name, startDate, endDate, locationName, coords, from: "template" \| tripId }` |
| `PATCH /api/g/[groupId]/trips/[tripId]/members/[userId]` | `{ onTrip?, isShopper? }` |

**Files.** Logic in `src/lib/group-admin.ts` (members, roles, trips) and `src/lib/trip-template.ts`
(template and copy); the page at `src/app/(app)/g/[groupId]/page.tsx` (server: gate, then a client
component `src/components/group-admin.tsx`), outside any trip like `/admin`. Hebrew copy uses the
"מנהל/ת" style phase 4 uses; emails render with `dir="ltr"`.

## Testing to do

- Locally as made-up users (see `docs/handoff.md`): a group admin, an editor, a viewer, someone in
  another group, and the super admin. Matrix: outsider 404 and member 403 on every `/api/g/...`
  route; self-removal and last-admin demotion refused; money block on demote, remove and trip
  removal; a removed person gets 401 from the API and `/no-access` on pages; a duplicate name is
  refused; trip from template and from a copy (meals shifted, links intact).
- Roadmap section 10's preview list, with Ido signing in on the branch alias.
- `npm run typecheck && npm run build`.
