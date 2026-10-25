CREATE TABLE "claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" varchar NOT NULL,
	"card_id" varchar NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "claims_family_card_unique" UNIQUE("family_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "item_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" varchar NOT NULL,
	"kind" text,
	"thumbnail" text,
	"receipt_image" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "household" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "parent1_work" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "parent2_work" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "insurance" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "saved_at" timestamp;--> statement-breakpoint
ALTER TABLE "offer_checks" ADD COLUMN "source" text DEFAULT 'court' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "photo_id" integer;