# A09: Trips, memberships and the trip switcher

**What to build:** A new server function, `loadMemberships(userId)`, returns the caller's groups with their role in each, each group's trips with a phase (now, planning or past, from the trip's dates in Israel time), and the trips where the caller is a shopper. The trips screen loads through it and matches its board: trips grouped by group, in עכשיו / בתכנון / היינו שם sections. The trip switcher pop-up in the header matches its board. Seam S2.

**Blocked by:** A01: Test setup; A02: Shared design parts and states

**Status:** ready-for-agent

- [ ] Tests (written first) cover: phase on a trip's first day, last day and the day after, in Israel time; viewer in one group and admin in another; the super admin; a group with no trips; shopper flags per trip; a group the caller is not in never appears
- [ ] The trips screen shows groups and the three sections; empty sections are hidden
- [ ] "טיול חדש" keeps working where it exists today (the sheet comes in Spec B)
- [ ] The trip switcher groups trips by group as its board shows
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
