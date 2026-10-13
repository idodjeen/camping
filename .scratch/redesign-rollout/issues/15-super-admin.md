# A15: Super admin

**What to build:** The super admin's groups screen matches its board: groups, their trips, and creating a group with its first admin, using the shared people field from A13.

**Blocked by:** A02: Shared design parts and states; A13: Group admin

**Status:** ready-for-agent

- [ ] Creating a group and setting its first admin work as before
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent

## Comments

- 2026-10-10, perf sprint P02 (sidebar diagnosis): opening this page from the trip menu (ניהול קבוצות) leaves the
  trip shell, so the header and the bottom bar vanish the moment it opens, and it has no loading state. Before
  P02 the tap also waited for the server with the menu already closed (0.84 s with 150 ms of added latency,
  measured on the group admin page, which works the same way).
  P02 prefetches the menu row, so the wait goes; the jump out of the shell stays. Not redesigned in P02, per
  Ido: decide here whether this page keeps the trip shell or leaves it on purpose, and give it a loading state.
