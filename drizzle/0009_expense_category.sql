ALTER TABLE "expenses" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "edited_at" timestamp with time zone;