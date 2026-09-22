CREATE TYPE "public"."meal_slot" AS ENUM('breakfast', 'lunch', 'dinner');--> statement-breakpoint
CREATE TABLE "gear_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "gear_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "gear_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"gear_item_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"is_packed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gear_claims_item_user_uq" UNIQUE("gear_item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "gear_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"qty_needed" integer,
	"qty_label" text,
	"is_optional" boolean DEFAULT false NOT NULL,
	"is_open_quantity" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gear_items_category_name_uq" UNIQUE("category_id","name")
);
--> statement-breakpoint
CREATE TABLE "meal_shopping_items" (
	"meal_id" integer NOT NULL,
	"shopping_item_id" integer NOT NULL,
	CONSTRAINT "meal_shopping_items_meal_id_shopping_item_id_pk" PRIMARY KEY("meal_id","shopping_item_id")
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "meals_date_slot_uq" UNIQUE("date","slot")
);
--> statement-breakpoint
CREATE TABLE "personal_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_packed" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shopping_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"quantity_text" text,
	"notes" text,
	"is_bought" boolean DEFAULT false NOT NULL,
	"bought_by" integer,
	"bought_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shopping_items_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"location_name" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"avatar_url" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_shopper" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "gear_claims" ADD CONSTRAINT "gear_claims_gear_item_id_gear_items_id_fk" FOREIGN KEY ("gear_item_id") REFERENCES "public"."gear_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_claims" ADD CONSTRAINT "gear_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_category_id_gear_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."gear_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_shopping_items" ADD CONSTRAINT "meal_shopping_items_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_shopping_items" ADD CONSTRAINT "meal_shopping_items_shopping_item_id_shopping_items_id_fk" FOREIGN KEY ("shopping_item_id") REFERENCES "public"."shopping_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_items" ADD CONSTRAINT "personal_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_category_id_shopping_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."shopping_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_bought_by_users_id_fk" FOREIGN KEY ("bought_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;