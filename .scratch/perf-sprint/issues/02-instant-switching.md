# P02: Instant switching

**What to build:** A tap on a bottom tab, a menu row or a filter chip changes the screen at once, without
waiting for the server, with a short, smooth transition, and the menu stops breaking while it switches.
Real-user speed becomes visible: Speed Insights, and a timer from the tap to the screen and its content.

**Blocked by:** P01 (built on its branch, so these tracker rows exist)

**Status:** PR open

**Files touched:** `src/components/bottom-nav.tsx`, `src/components/app-header.tsx`,
`src/components/side-sheet.tsx`, `src/components/filter-chips.tsx`,
`src/app/(app)/t/[tripId]/template.tsx`, `src/app/(app)/t/[tripId]/layout.tsx`,
`src/app/(app)/t/[tripId]/loading.tsx` (new), `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/nav.ts`,
`next.config.ts`, `src/proxy.ts`, the tap timer (new: `src/lib/tap-timer.ts`, `src/app/api/timing/route.ts`),
`package.json` and `package-lock.json` (Speed Insights), `docs/handoff.md`, notes on A13 and A15.

- [x] Bottom tabs and menu rows use `<Link prefetch>`: in a production build a prefetched tab switches without a new request
- [x] A short client cache (`staleTimes.dynamic`, 30 s) covers screens that weren't prefetched
- [x] The tapped tab lights up on the tap, not when the server answers
- [x] Filter chips change the URL through the History API: no request, instant
- [x] The transition is a CSS fade from 40% to 100% in 150 ms, ease-out; no blur, scale or slide; nothing is left on the wrapper afterwards; reduced motion turns it off
- [x] The hydration workaround in `template.tsx` is gone, and the account page's guide overlay covers the whole screen (it was 335x617 at (20, 88) on a 375x812 screen, anchored by the old wrapper's leftover `filter: blur(0px)`)
- [x] The menu's admin rows come from the server, so they are there the moment it opens, and the header stops polling `/me` for them (moved here from P03: with the rows from the server the poll has nothing left to read)
- [x] The menu's backdrop is a plain dim, with no blur
- [x] A loading skeleton (`t/[tripId]/loading.tsx`) shows at once whenever a screen wasn't prefetched
- [x] The sidebar UI break is reproduced locally, named and fixed (below); A13 and A15 have a note for the pages outside the trip shell
- [x] Speed Insights is installed; the tap timer records tap to screen and tap to content, and logs a `tap-timing` line per tap
- [ ] Checked on the preview by Ido, on a phone, in light and dark
- [ ] Done per the spec's definition of done

## The sidebar UI break (2026-10-10)

Reproduced on a local production build with a throwaway user, 150 ms of added latency and a 4x CPU slowdown,
filmed frame by frame. It was suspects 1 and 2, made worse by the old transition, plus 3 and 4:

1. **The menu closed on the tap, the page came later** (suspect 1). For about 280 ms the old screen sat still
   under the sliding sheet, waiting for the server.
2. **Then a blank and a blur.** At the switch the old screen vanished and the new one arrived at opacity 0,
   blurred 6 px and scaled to 97%. For a few frames the content area was empty, then a blurred skeleton slid in,
   under the sheet's full-screen backdrop blur (suspect 2).
3. **Rows popped in** (suspect 4). Opened right after load, the menu showed 5 rows, then 7 at 839 ms when `/me`
   answered.
4. **Leaving the trip shell** (suspect 3). ניהול הקבוצה waited 844 ms with the menu closed, then the header and the
   bottom bar disappeared. P02 prefetches the row (now 138 ms); the jump out of the shell is for A13 and A15.

After P02 the new screen is in place at about 127 ms, behind the closing sheet, at 40% and sharp.

## Measured before and after

Local production build of `origin/main` and of this branch, a throwaway user on a template trip, phone-sized
headless Chrome, 150 ms added per request, 4x CPU slowdown, taps by touch. Medians; "visible" is when the new
screen's content is at 95% opacity or more. "Server page requests" are the requests a tap waits on.

| Tap | Before: switch / visible | After: switch / visible | Server page requests |
|---|---|---|---|
| A tab, seen before (n=13) | 237 / 490 ms | 98 / 216 ms | 1 then 0 |
| A tab, first visit (n=2) | 398 / 1454 ms | 103 / 764 ms | 1-2 then 0-1 |
| A menu row, seen before (n=8) | 238 / 508 ms | 91 / 214 ms | 1-2 then 0 |
| A menu row, first visit (n=2) | 399 / 1339 ms | 95 / 950 ms | 1 then 0 |
| A filter chip (n=10) | 247 ms | 89 ms | 1 then 0 |
| ניהול הקבוצה from the menu | 844 ms | 138 ms | 1 then 0 |
| Transition | spring from opacity 0, 6 px blur, scale 0.97 | CSS fade 40% to 100%, 150 ms | |

First visits still wait for the screen's data (one API round trip): that is P05. What is left of a switch
(about 90-100 ms here) is rendering at 4x slowdown; P04 lightens the gear screen.

The tap timer starts at the click, a little after the finger lands, so its `tap-timing` numbers run lower than
these touch-based ones.

From Israel, one server round trip took 0.23-0.36 s warm and 1.2-1.4 s cold (`curl`, 2026-10-09). P02 doesn't
change that number; it takes the round trip out of the tap.
