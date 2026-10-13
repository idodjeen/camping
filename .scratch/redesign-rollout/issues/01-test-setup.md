# A01: Test setup

**What to build:** A test runner the whole sprint can build on, per ADR 0001. `npm test` runs Vitest against PGlite, an in-process Postgres with the real drizzle migrations applied, plugged in through the same global database switch the scripts already use. No test ever touches the shared `dev` database.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `npm test` runs and passes locally with no network and no env files
- [ ] Each test file gets a fresh database with every migration applied
- [ ] A small seeding helper creates a group, a trip, members with roles, and items, so tests read as scenarios
- [ ] One real test calls an existing lib function (for example the inbox) with plain ids and checks the result
- [ ] The handoff's gates mention `npm test` next to typecheck and build
- [ ] Done per Spec A's definition of done: typecheck, build and tests pass; checked in the preview at phone width in light and dark; no old class names left on the touched screens; board updated if the screen differs from it; PR title carries `[no-popup]`; not merged by the agent
