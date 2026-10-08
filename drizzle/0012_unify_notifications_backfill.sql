-- Hand-written backfill for 0011 (drizzle-kit generate --custom). Every statement is
-- idempotent: the tag INSERT and the read_at sync are run again by hand after the
-- production deploy, to pick up tags written by the previous code in between.

-- thread_key for the bell rows that already exist: messages, then "covered".
UPDATE notifications n SET thread_key = CASE
    WHEN c.gear_item_id IS NOT NULL THEN 'gear:' || c.gear_item_id
    WHEN c.shopping_item_id IS NOT NULL THEN 'shopping:' || c.shopping_item_id
    WHEN c.meal_id IS NOT NULL THEN 'meal:' || c.meal_id
    ELSE 'chat' END
  FROM comments c
  WHERE c.id = n.comment_id AND n.thread_key IS NULL;--> statement-breakpoint

UPDATE notifications SET thread_key = 'gear:' || gear_item_id
  WHERE kind = 'covered' AND thread_key IS NULL;--> statement-breakpoint

-- Copy the tags into the same table, oldest first so the new ids keep the order
-- they were written in. Always written, whatever the person's switches say: they
-- also drive the "tagged you" markers on list rows. The bell hides them when tag
-- notifications are off.
INSERT INTO notifications (trip_id, user_id, kind, actor_id, comment_id, thread_key, read_at, created_at)
SELECT c.trip_id, m.user_id, 'mention', c.user_id, m.comment_id,
  CASE
    WHEN c.gear_item_id IS NOT NULL THEN 'gear:' || c.gear_item_id
    WHEN c.shopping_item_id IS NOT NULL THEN 'shopping:' || c.shopping_item_id
    WHEN c.meal_id IS NOT NULL THEN 'meal:' || c.meal_id
    ELSE 'chat' END,
  m.read_at, c.created_at
FROM comment_mentions m
JOIN comments c ON c.id = m.comment_id
ORDER BY c.created_at, c.id, m.id
ON CONFLICT (comment_id, user_id) WHERE kind = 'mention' DO NOTHING;
