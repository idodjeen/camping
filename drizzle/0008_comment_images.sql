ALTER TABLE "comments" ADD COLUMN "image_public_id" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "image_width" integer;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "image_height" integer;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_has_content" CHECK (length("comments"."body") > 0 OR "comments"."image_public_id" IS NOT NULL);