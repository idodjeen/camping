# Spec P: Perf sprint

**Status:** ready-for-agent
**Runs:** before A03 of Spec A. Planned 2026-10-10 from the screen-switching analysis of 2026-10-09.
**Words:** `GLOSSARY.md`. **Tracker:** `docs/roadmap-redesign.md`.

## Problem Statement

Switching screens on the live app is slow. The bottom tabs, the menu rows and the filter chips all wait
for the server before anything moves, and the menu also breaks visually while it switches. Measured or
read from the code on 2026-10-09:

- **Every tap waits for a server round trip.** The trip screens are dynamic routes with no `loading.tsx`,
  no `prefetch` and no client cache, so Next.js fetches each one on click (Next 16 docs, "Prefetching":
  a dynamic page without `loading.js` is not prefetched, has no client cache and makes a round trip on click).
- **Then a second round trip.** Every trip screen is a client page that starts fetching its data only after
  it mounts.
- **Each round trip is long from Israel.** Phone, Frankfurt edge, functions in Virginia (`iad1`):
  0.23-0.36 s warm, 1.2-1.4 s when a function is cold.
- **Production rebuilds often.** 25 production builds on Oct 7-9, 8 of them docs-only. Each one leaves every
  function cold and makes every open tab reload on its next tap.
- **The server works in series.** Every trip API call reads the person, then their access, then the data.
  `/me` runs 6 queries one after another, the lists 5.
- **The phone works hard on each switch.** A spring, blur and scale transition that starts from invisible,
  and every list row mounts a hidden comment sheet (41 on a new trip's gear screen).

## Solution

Six tickets, one PR each, in this order: P01, P02, P03, then measure and report to Ido before going on,
then P04, P05, P06.

| Ticket | What | PR title |
|---|---|---|
| [P01](issues/01-skip-docs-builds.md) | Production skips docs-only commits | `[no-popup]` |
| [P02](issues/02-instant-switching.md) | Instant switching: prefetch, client cache, instant highlight, chips without the server, a short CSS fade, sidebar fixes, a loading skeleton; Speed Insights and a tap timer | Hebrew: campers feel it |
| [P03](issues/03-less-server-work.md) | Less server work per request | `[no-popup]` |
| [P04](issues/04-comment-sheet-on-open.md) | The comment sheet mounts only when opened | `[no-popup]` |
| [P05](issues/05-preload-other-tabs.md) | Other tabs' data loads in the background | `[no-popup]` |
| [P06](issues/06-frankfurt-move.md) | Move to Frankfurt (Vercel `fra1`, Neon eu-central-1) | `[no-popup]` |

## Measuring

Every ticket records a before and an after in its own file.

- **Locally, for the client tickets (P02, P04, P05):** a production build (`next build`, `next start`) of
  the branch and of `origin/main`, a throwaway test user on a test trip, 150 ms added to every request in
  the browser, five taps per screen, the median. Reported: tap to screen switched, tap to content, and how
  many requests a tap makes.
- **Locally, for the server ticket (P03):** sequential database round trips per endpoint, and each
  endpoint's time against the `dev` database from Israel. That is about 140 ms per round trip, so it shows
  the round trips clearly; production's database sits in the same region as its functions.
- **Real users, after P02 merges:** Speed Insights in the Vercel dashboard, and the tap timer's
  `tap-timing` lines in the Vercel logs (`vercel logs --environment production`; Hobby keeps about an hour).
- **From Ido's Mac, for P06:** `curl` timings and the `x-vercel-id` header, as on 2026-10-09.

## Out of Scope

- Redesigning any screen: Spec A and B.
- The pages outside the trip shell (`/g/[groupId]`, `/admin`): A13 and A15.
- Realtime updates instead of polling.
- Keep-warm pings for Neon's scale-to-zero: decided after the measure step.
- Removing the legacy routes and adapters: cleanup H.

## Definition of done (every ticket)

Typecheck and build pass; checked on the preview at phone width in light and dark; the before and after
are recorded in the ticket; the tracker row and the ticket's `Status:` line are updated in the PR itself;
not merged by the agent.
