"use client";

import type { SWRConfiguration } from "swr";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Session expiry is the case to get right here.
 *
 * When a session lapses, the proxy redirects API calls to /login — and `fetch`
 * follows redirects, so what comes back is the login page's HTML with status
 * **200**. Parsing that as JSON yields {}, which looks like a successful empty
 * response: every consumer then reads a missing field and crashes with a white
 * screen. Detecting the redirect (and any non-JSON body) turns that into a
 * clean error SWR can surface.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (res.redirected || !res.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(401, "ההתחברות פגה — רעננו את הדף");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? "שגיאה בטעינה");
  return json as T;
}

export async function send<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? "משהו השתבש");
  return json as T;
}

/**
 * Polling is what makes five people editing the same list feel shared: a claim
 * made on someone else's phone shows up here within 15 seconds, and instantly
 * when the tab regains focus. `keepPreviousData` stops the page blanking to a
 * skeleton on every poll.
 */
export const swrConfig: SWRConfiguration = {
  refreshInterval: 15_000,
  revalidateOnFocus: true,
  keepPreviousData: true,
  shouldRetryOnError: false,
};
