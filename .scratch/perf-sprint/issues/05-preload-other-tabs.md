# P05: Other tabs' data loads in the background

**What to build:** The first visit to a screen shows its data at once instead of a skeleton, because the
data was fetched in the background after the app opened.

**Blocked by:** P04

**Status:** ready-for-agent

**Files touched:** a preload hook in `src/lib/`, the trip layout, maybe `src/lib/api.ts`.

- [ ] Once the first screen has its data and the app is idle, the bottom tabs' data (and the home screen's) loads once in the background, under the same SWR keys the screens use
- [ ] No extra polling: a preloaded key polls only while its screen is open, as today
- [ ] It skips when the connection asks to save data (`navigator.connection.saveData`)
- [ ] Done per the spec's definition of done

## Measured before and after

| | Before | After |
|---|---|---|
| First visit to a tab | skeleton until its request returns | |
| First visit, tap to content (local, see the spec) | | |
| Extra requests when the app opens | 0 | |
