# P02: Instant switching

**What to build:** A tap on a bottom tab, a menu row or a filter chip changes the screen at once, without
waiting for the server, with a short, smooth transition, and the menu stops breaking while it switches.
Real-user speed becomes visible: Speed Insights, and a timer from the tap to the screen and its content.

**Blocked by:** P01 (built on its branch, so these tracker rows exist)

**Status:** claimed (branch `claude/perf-instant-switch`)

**Files touched:** `src/components/bottom-nav.tsx`, `src/components/app-header.tsx`,
`src/components/side-sheet.tsx`, `src/components/filter-chips.tsx`,
`src/app/(app)/t/[tripId]/template.tsx`, `src/app/(app)/t/[tripId]/layout.tsx`,
`src/app/(app)/t/[tripId]/loading.tsx` (new), `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/nav.ts`,
`next.config.ts`, `src/proxy.ts`, the tap timer (new: `src/lib/tap-timer.ts`, `src/app/api/timing/route.ts`),
`package.json` and `package-lock.json` (Speed Insights), `docs/handoff.md`.

- [ ] Bottom tabs and menu rows use `<Link prefetch>`: in a production build a prefetched tab switches without a new request
- [ ] A short client cache (`staleTimes.dynamic`) covers screens that weren't prefetched
- [ ] The tapped tab lights up on the tap, not when the server answers
- [ ] Filter chips change the URL through the History API: no request, instant
- [ ] The transition is a CSS fade from 40% to 100% in about 150 ms, ease-out; no blur, scale or slide; nothing is left on the wrapper afterwards; reduced motion turns it off
- [ ] The hydration workaround in `template.tsx` is gone, and the account page's guide overlay covers the whole screen
- [ ] The menu's admin rows come from the server, so they are there the moment it opens, and the header stops polling `/me` for them (moved here from P03: with the rows from the server the poll has nothing left to read)
- [ ] The menu's backdrop is a plain dim, with no blur
- [ ] A loading skeleton (`t/[tripId]/loading.tsx`) shows at once whenever a screen wasn't prefetched
- [ ] The sidebar UI break is reproduced locally, named (suspects 1-5 from the analysis) and fixed; if it is the pages outside the trip shell, A13 and A15 get a note instead
- [ ] Speed Insights is installed; the tap timer records tap to screen and tap to content, and logs a `tap-timing` line per tap
- [ ] Done per the spec's definition of done

## Measured before and after

Local production build, 150 ms added per request, median of 5 taps (see the spec). Filled in by the PR.

| | Before | After |
|---|---|---|
| Tap a tab: requests before the screen switches | | |
| Tap a tab: tap to screen switched | | |
| Tap a tab: tap to content | | |
| Tap a menu row: tap to screen switched | | |
| Tap a filter chip: requests, tap to list changed | | |
| Transition | spring from opacity 0, 6 px blur, scale 0.97 | |

From Israel, one server round trip took 0.23-0.36 s warm and 1.2-1.4 s cold (`curl`, 2026-10-09). P02 doesn't
change that number; it takes the round trip out of the tap.
