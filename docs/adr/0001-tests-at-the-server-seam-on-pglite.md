# Tests at the server seam, on PGlite

The app had no tests, and the sprint workflow builds every ticket test-first. We test through the
highest server seam, the `src/lib` functions and route handlers, with Vitest against PGlite (Postgres
running inside the test process, with the real drizzle migrations applied), and check screens by eye in
the preview in both themes.

## Considered options

- **The shared Neon `dev` database.** Rejected: every preview and every parallel session already uses
  it, so test rows would collide and a dropped connection would make tests flaky.
- **Component tests for screens.** Rejected for now: the redesign changes markup on almost every screen,
  so these tests would mostly be rewritten, and what they would check (colours in two themes, RTL) is
  faster to check by eye.
