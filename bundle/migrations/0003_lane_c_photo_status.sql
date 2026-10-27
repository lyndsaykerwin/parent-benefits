-- Lane C (Oct 26 2026): background photo reading and the date of manufacture.
-- Additive only. Applied to Neon by hand (never db:push); the local test database gets it from scripts/db-test-setup.sh.
ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'done' NOT NULL;
ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "read_error" text;
ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "read_result" jsonb;
ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "manufactured_on" text;
