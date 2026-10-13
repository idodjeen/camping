import { afterAll, beforeAll } from "vitest";

import { closeDb, freshDb } from "./db";

// One database per test file: tests in a file share it, files never do.
beforeAll(async () => {
  await freshDb();
});

afterAll(async () => {
  await closeDb();
});
