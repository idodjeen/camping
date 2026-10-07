/**
 * Remembers the last trip opened, so `/` and old links (/gear, push
 * notifications sent before trips existed) land in the right place.
 *
 * Its own file because both the server (lib/trips.ts) and a client component
 * need the name, and a client module must not import the database.
 */
export const LAST_TRIP_COOKIE = "last_trip";
