# P04: The comment sheet mounts only when opened

**What to build:** A list row no longer mounts a full, hidden comment sheet with its own data hooks and
overlay effects. The sheet mounts the first time its row's bubble is tapped, and stays mounted so it can
animate out.

**Blocked by:** P03 and the measure step. Merge after #31: both touch `src/components/comments.tsx`.

**Status:** ready-for-agent

**Files touched:** `src/components/comments.tsx`.

- [ ] Before the first tap, a row renders only its bubble: no sheet, no SWR hooks, no overlay effects
- [ ] Opening, closing (with its animation), posting, deleting and reading a thread work as before
- [ ] Done per the spec's definition of done

## Measured before and after

| | Before | After |
|---|---|---|
| Hidden comment sheets on a new trip's gear / shopping / meals screen | 41 / 23 / 7 | |
| Gear screen, tap to content (local, see the spec) | | |
