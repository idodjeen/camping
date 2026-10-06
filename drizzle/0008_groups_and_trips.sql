CREATE TYPE "public"."member_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "member_role" DEFAULT 'editor' NOT NULL,
	"added_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_members" (
	"trip_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_shopper" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_members_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "gear_categories" DROP CONSTRAINT "gear_categories_name_unique";--> statement-breakpoint
ALTER TABLE "meals" DROP CONSTRAINT "meals_date_slot_uq";--> statement-breakpoint
ALTER TABLE "shopping_categories" DROP CONSTRAINT "shopping_categories_name_unique";--> statement-breakpoint
ALTER TABLE "shopping_items" DROP CONSTRAINT "shopping_items_name_unique";--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_gear_item_id_gear_items_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_shopping_item_id_shopping_items_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_meal_id_meals_id_fk";
--> statement-breakpoint
ALTER TABLE "gear_items" DROP CONSTRAINT "gear_items_category_id_gear_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "meal_shopping_items" DROP CONSTRAINT "meal_shopping_items_meal_id_meals_id_fk";
--> statement-breakpoint
ALTER TABLE "meal_shopping_items" DROP CONSTRAINT "meal_shopping_items_shopping_item_id_shopping_items_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_comment_id_comments_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_gear_item_id_gear_items_id_fk";
--> statement-breakpoint
ALTER TABLE "shopping_items" DROP CONSTRAINT "shopping_items_category_id_shopping_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "gear_categories" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "gear_items" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_shopping_items" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "personal_items" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_categories" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD COLUMN "trip_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Hand-written: the original group, which the existing trip and everyone in it now belong to.
INSERT INTO "groups" ("name", "created_by")
  SELECT 'מחנאות', (SELECT "id" FROM "users" WHERE "is_admin" ORDER BY "id" LIMIT 1);--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "group_id" integer;--> statement-breakpoint
UPDATE "trip" SET "group_id" = (SELECT min("id") FROM "groups");--> statement-breakpoint
ALTER TABLE "trip" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
-- Hand-written: the old seed inserted trip 1 with an explicit id, which never advanced the
-- sequence, so the first trip created from the app would also have been given id 1.
-- setval is strict, so on a fresh database (no trips, max = NULL) this does nothing.
SELECT setval(pg_get_serial_sequence('trip', 'id'), (SELECT max("id") FROM "trip"));--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Hand-moved: composite FKs below need these (trip_id, …) unique keys to exist first.
ALTER TABLE "comments" ADD CONSTRAINT "comments_trip_id_uq" UNIQUE("trip_id","id");--> statement-breakpoint
ALTER TABLE "gear_categories" ADD CONSTRAINT "gear_categories_trip_name_uq" UNIQUE("trip_id","name");--> statement-breakpoint
ALTER TABLE "gear_categories" ADD CONSTRAINT "gear_categories_trip_id_uq" UNIQUE("trip_id","id");--> statement-breakpoint
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_trip_id_uq" UNIQUE("trip_id","id");--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_trip_date_slot_uq" UNIQUE("trip_id","date","slot");--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_trip_id_uq" UNIQUE("trip_id","id");--> statement-breakpoint
ALTER TABLE "shopping_categories" ADD CONSTRAINT "shopping_categories_trip_name_uq" UNIQUE("trip_id","name");--> statement-breakpoint
ALTER TABLE "shopping_categories" ADD CONSTRAINT "shopping_categories_trip_id_uq" UNIQUE("trip_id","id");--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_trip_name_uq" UNIQUE("trip_id","name");--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_trip_id_uq" UNIQUE("trip_id","id");--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trip_members_user_idx" ON "trip_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_gear_item_fk" FOREIGN KEY ("trip_id","gear_item_id") REFERENCES "public"."gear_items"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_shopping_item_fk" FOREIGN KEY ("trip_id","shopping_item_id") REFERENCES "public"."shopping_items"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_meal_fk" FOREIGN KEY ("trip_id","meal_id") REFERENCES "public"."meals"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_categories" ADD CONSTRAINT "gear_categories_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_category_fk" FOREIGN KEY ("trip_id","category_id") REFERENCES "public"."gear_categories"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_shopping_items" ADD CONSTRAINT "meal_shopping_items_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_shopping_items" ADD CONSTRAINT "meal_shopping_items_meal_fk" FOREIGN KEY ("trip_id","meal_id") REFERENCES "public"."meals"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_shopping_items" ADD CONSTRAINT "meal_shopping_items_item_fk" FOREIGN KEY ("trip_id","shopping_item_id") REFERENCES "public"."shopping_items"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_fk" FOREIGN KEY ("trip_id","comment_id") REFERENCES "public"."comments"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_gear_item_fk" FOREIGN KEY ("trip_id","gear_item_id") REFERENCES "public"."gear_items"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_items" ADD CONSTRAINT "personal_items_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_categories" ADD CONSTRAINT "shopping_categories_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_category_fk" FOREIGN KEY ("trip_id","category_id") REFERENCES "public"."shopping_categories"("trip_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_group_idx" ON "trip" USING btree ("group_id");--> statement-breakpoint
-- Hand-written backfill: everyone already here joins the original group and its trip.
UPDATE "users" SET "is_super_admin" = true WHERE "is_admin";--> statement-breakpoint
INSERT INTO "group_members" ("group_id", "user_id", "role")
  SELECT g."id", u."id", CASE WHEN u."is_admin" THEN 'admin'::"member_role" ELSE 'editor'::"member_role" END
  FROM "users" u CROSS JOIN (SELECT min("id") AS "id" FROM "groups") g;--> statement-breakpoint
-- There is exactly one trip at this point (none on a fresh database, so no rows).
INSERT INTO "trip_members" ("trip_id", "user_id", "is_shopper")
  SELECT t."id", u."id", u."is_shopper" FROM "users" u CROSS JOIN "trip" t;
