# Tests at the server seam, on PGlite

The app had no tests, and the sprint workflow builds every ticket test-first. We test through the
`src/lib` functions, which take plain ids, with Vitest against PGlite (Postgres running inside the test
process, with the real drizzle migrations applied), plugged in through the same `globalThis.__campingDb`
switch the scripts already use. Route handlers stay thin wrappers around a session gate and one lib call,
and are not tested directly. Screens are checked by eye in the preview in both themes.

## Considered options

- **The shared Neon `dev` database.** Rejected: every preview and every parallel session already uses
  it, so test rows would collide and a dropped connection would make tests flaky.
- **Testing route handlers.** Rejected: it means faking the Auth.js session, which is brittle in this
  Next version, and the handlers hold no logic of their own.
- **Component tests for screens.** Rejected for now: the redesign changes markup on almost every screen,
  so these tests would mostly be rewritten, and what they would check (colours in two themes, RTL) is
  faster to check by eye.
