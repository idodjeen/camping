ALTER TABLE "comments" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "gear_categories" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "gear_items" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "meal_shopping_items" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "personal_items" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shopping_categories" ALTER COLUMN "trip_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shopping_items" ALTER COLUMN "trip_id" DROP DEFAULT;