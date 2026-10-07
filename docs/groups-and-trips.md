# Groups and trips: plan

> Agreed 2026-10-06. Turns the single-group app into one that hosts many friend groups, each with
> its own trips, and keeps every group's data invisible to the others. It supersedes roadmap item 0:
> the nav redesign is folded into phase 3, and roadmap items 1-7 come after this work, so they are
> built trip-aware from the start.

## Decisions

| Question | Decision |
|---|---|
| What an organization is | A **group** with a name. It holds the people and their roles. A group has many **trips**, and all content (gear, meals, shopping, expenses, chat) belongs to a trip. |
| One person in several groups | Yes, with a role per group and a switcher in the header. |
| What a new trip starts with | A copy of the template (today's gear and shopping lists) or of an earlier trip in the same group. New screens let the admin edit trip details, categories and meals. |
| Who manages members | The group admin for their own group. The super admin for every group. |
| Who is on a trip | Picked per trip, defaulting to the whole group. The shopper role is set per trip. |
| How people hear they were added | The app shows a ready Hebrew message with the link, to paste into WhatsApp. No email. |
| Testing | A Neon dev branch for local dev and previews. Production is not touched until the migration passes there. |

## Roles

| Role | Stored in | Can |
|---|---|---|
| Super admin | `users.is_super_admin` | Everything in every group, including creating groups and setting their first admin. |
| Group admin | `group_members.role = 'admin'` | Manage members, create trips, edit trip details, categories and meals, set shoppers, delete any comment or expense. |
| Editor | `group_members.role = 'editor'` | Everything a member can do today. |
| Viewer | `group_members.role = 'viewer'` | Read only. Every write returns 403, as today. |
| Shopper | `trip_members.is_shopper` | Tick shopping items as bought, in that trip only. |

## Data model

**New tables**

- `groups`: id, name, created_by, created_at
- `group_members`: group_id, user_id, role (`admin` / `editor` / `viewer`), added_by, created_at. Primary key (group_id, user_id).
- `trip`: the existing table, now holding every trip, plus `group_id` and `created_at`. It keeps
  its singular name because drizzle-kit can only rename a table through an interactive prompt.
- `trip_members`: trip_id, user_id, is_shopper. Primary key (trip_id, user_id).

**`users`** gets `is_super_admin`. `is_admin` and `is_shopper` move into the membership tables.
Since phase 2 no code reads them; the columns are dropped in the roadmap's cleanup PR (H), because
drops only ship after the code that used them is gone. Name and slug stay global, so a person has one name
everywhere. Viewers become real rows, which removes the synthetic `id: 0` user in
`src/lib/session.ts`.

**Scoping content to a trip**

| Tables | How they're scoped |
|---|---|
| `gear_categories`, `shopping_categories`, `meals`, `comments`, `notifications`, `personal_items`, `expenses`, `settlements` | Their own `trip_id NOT NULL` |
| `gear_items`, `shopping_items`, `meal_shopping_items` | Their own `trip_id`, plus a composite FK to the parent's `(trip_id, id)`, so a row can never point into another trip |
| `gear_claims`, `comment_mentions`, `expense_shares` | Through their parent, which every write path loads with a trip check first |

`comments` and `notifications` also get composite FKs to the item they reference. A null item
column (general chat) skips the check, which is exactly what's wanted.

These unique constraints become per trip: category names, shopping item names, and
`meals (date, slot)`.

Notification preferences and push subscriptions stay per person, because a person has one phone
and one bell setting. Push payload URLs carry the trip path.

## Keeping groups apart

1. **One gate per request.** `requireTrip(tripId, "read" | "write" | "admin")` in
   `src/lib/session.ts` loads the trip, its group and the caller's role. It answers 404 when the
   caller isn't a member, so a stranger can't even tell that a trip id exists. Every trip route
   starts with it, replacing `requireReader` / `requireUser`.
2. **Every query is filtered by the trip from that gate**, never by a trip id from the request
   body. Lookups by item id become `where id = ? and trip_id = ?`, which stops someone reaching
   another group's rows by guessing ids.
3. **Composite foreign keys** make links between trips impossible in the database itself, even if
   a write forgets a filter.
4. **The people named in a write must be on that trip**: expense payer, split, settlement, mentions.
   @mentions only resolve against that trip's people.
5. **Sign-in is allowed** when the email belongs to a super admin or to any group. The check moves
   from the Edge config (env lists) into `src/auth.ts` (database). `ALLOWED_USERS` and
   `VIEWER_USERS` are retired after the import.

Postgres row-level security is left out on purpose. It would need every query wrapped in a
transaction that sets the trip id, and the Pool driver's connection reuse makes that easy to get
wrong. Layers 1-3 give an app this size the same practical guarantee. Revisit it if the app ever
opens to the public.

## URLs

| Path | What |
|---|---|
| `/` | Your trips, listed by group. With only one trip, it opens that trip directly. Remembers your last trip. |
| `/t/[tripId]/…` | Every current screen: home, gear, meals, shopping, expenses, chat, room, leaderboard, me |
| `/api/t/[tripId]/…` | Every trip-scoped API route |
| `/g/[groupId]` | Group admin: members, trips, invite message |
| `/admin` | Super admin: all groups, create a group |

Old links redirect to the same screen in your last-used trip. That covers bookmarks and push
notifications already sitting on phones.

## Migrating today's data

One migration, run on the Neon dev branch first:

1. Create `groups`, `group_members` and `trip_members`. Add `group_id` to `trip`.
2. Insert group 1 (its name is set later in the UI) and attach trip 1 to it.
3. Add `trip_id NOT NULL DEFAULT 1` to every content table, then swap the unique constraints and
   foreign keys. The default is temporary: it let the phase 1 code keep inserting unchanged. Since
   phase 2 every insert names its trip. The default **must be dropped before a second trip can be
   created (phase 4)**, so an insert that forgets its trip fails instead of landing in trip 1.
4. Every existing user becomes an editor in group 1 and a member of trip 1. `is_admin` becomes
   group admin and super admin. `is_shopper` becomes `trip_members.is_shopper`.
5. Fix the `trip` id sequence. The old seed inserted trip 1 with an explicit id, so the sequence
   never moved, and the first trip created from the app would have collided with it.
6. Viewers had no rows, and nobody can read `VIEWER_USERS` back (Vercel marks it Sensitive). Since
   phase 2, each person on it is imported as a group 1 viewer on their first sign-in, and only
   then: if an admin later removes them, signing in again doesn't bring them back. The variable
   and the import are deleted in phase 7.

Verified on the dev branch (2026-10-06): every table's row count matches production, all content
rows are in trip 1, balances match production to the agora, and links between trips are refused
by the database. A fresh database also migrates and seeds cleanly, twice in a row.

**Deploy order.** Run `0008` on production first, then merge. Old code keeps working against the
new schema, because nothing it reads or writes was removed. New code selects `trip_id`, so it must
not deploy before the column exists.

## Phases

Each phase is its own PR, and the app keeps working after each one. Status on 2026-10-08: phases
1-4 are live (PRs #5, #7, #9, #13); phase 5 is next. See `docs/handoff.md`.

1. **Dev database and schema.** The Neon branch, the new tables, `trip_id` on every content table,
   and the backfill. The app still reads trip 1 everywhere, so nothing visible changes.
2. **Access layer and URLs.** `requireTrip`, routes moved under `/t/[tripId]`, sign-in checked
   against the database, the env allowlist retired, and old URLs redirected. Your group sees the
   same app at new URLs. **No migration**, following the roadmap's rules (`docs/roadmap.md`, PR #4):
   - Old `/api/*` paths stay as one thin adapter (`src/app/api/[...legacy]/route.ts`) for a release,
     so a phone that had the app open during the deploy keeps working. Removed in H.
   - Old screen paths (`/gear`, push notifications already on phones) redirect to the same screen
     in the last trip opened.
   - Lands after the roadmap's group A (safety rails), which wraps the widgets of the app layout.
     That layout moves to `src/app/(app)/t/[tripId]/layout.tsx` here, so its wrappers move with it.
3. **Header and nav (roadmap item 0).** A sticky header holding the group/trip switcher, the bell
   and the menu. Three primary tabs, with the rest in a drawer. One nav config shared by the tabs,
   the drawer and `template.tsx`.
4. **Super admin.** At `/admin`: the list of groups, plus creating a group with its name, admin,
   editor list and viewer list (pasted emails with names). Shows the invite message.
5. **Group admin.** At `/g/[groupId]`: add and remove members, change roles, create a trip (from
   the template or an earlier trip), and choose each trip's people and shoppers.
6. **Content editing.** Trip name, dates and location. Add, rename and reorder categories. Create
   and edit meals and their ingredients.
7. **Clean-up.** Remove hardcoded names ("רק עידו וניר…", "דברו עם עידו"), scope reminders to a
   trip, update the README.

## Things only Ido can do

- ~~Neon dev branch~~ Done 2026-10-06. Local `.env.local` points at the `dev` branch, and the
  production lines are commented out. Since 2026-10-07 Vercel's Preview and Development also use
  `dev`, and preview sign-in works through `AUTH_REDIRECT_PROXY_URL`.
- **Google sign-in for new people (before phase 4).** The OAuth consent screen is in *Testing*,
  so only listed test users can sign in. Switch it to *In production*. With only the email and
  profile scopes, Google doesn't require verification.

## Defaults, unless decided otherwise

- Anyone in a group can open all of its trips. Only the people on a trip, plus group admins and
  the super admin, can change it; an editor who skipped a trip sees it read-only.
- Trip details, categories and meals can be edited by the group admin. Editors keep exactly what
  they can do today.
- A person has one name across all groups and can change it on their own profile.
- Removing someone from a trip releases their gear claims. If they already have expenses on that
  trip, removing them is blocked until those expenses are settled or deleted.
- The five existing avatar photos stay. Everyone else gets the gradient initial.
- Reminder emails go out from Ido's personal Gmail, so only the super admin can send them (per
  trip). Group admins get the WhatsApp message instead.
- The "what's new" pop-up after a deploy shows in every group.
