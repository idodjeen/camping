ALTER TABLE "users" ADD COLUMN "notify_prefs" jsonb DEFAULT '{"mentions":true,"chat":true,"lists":true,"money":true}'::jsonb NOT NULL;--> statement-breakpoint
-- Hand-written backfill: the three old switches into the new shape, keeping "money".
-- Idempotent, and run again by hand after the production deploy: until then the old code
-- still writes only the booleans. From the deploy on, setPrefs writes both, so they agree.
UPDATE "users" SET "notify_prefs" = "notify_prefs" || jsonb_build_object(
  'mentions', "notify_mentions", 'chat', "notify_messages", 'lists', "notify_covered");
