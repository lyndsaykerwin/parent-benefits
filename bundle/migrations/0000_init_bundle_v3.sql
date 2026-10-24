CREATE TABLE "amazon_orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"family_id" varchar NOT NULL,
	"order_date" date NOT NULL,
	"title" text NOT NULL,
	"asin" varchar,
	"upc" varchar,
	"price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefit_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar NOT NULL,
	"title" text NOT NULL,
	"scope" text NOT NULL,
	"amount_cents" integer,
	"window_start_days_from_birth" integer,
	"window_end_days_from_birth" integer,
	"condition" text DEFAULT '' NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "benefit_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "case_law_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"source_feedback_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"memory_id" text
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"is_guest" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"birth_date" date,
	"due_date" date,
	"zip" varchar(10) NOT NULL,
	"state" varchar(2) NOT NULL,
	"employer" text DEFAULT '' NOT NULL,
	"household_size" integer DEFAULT 3 NOT NULL,
	"annual_income_cents" integer,
	"dcfsa_offered" boolean DEFAULT false NOT NULL,
	"data_connected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" varchar NOT NULL,
	"card_id" varchar NOT NULL,
	"kind" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fsa_eligible_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" text NOT NULL,
	"category" text NOT NULL,
	"account" text NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" varchar NOT NULL,
	"store" text NOT NULL,
	"source_url" text,
	"fine_print_hash" varchar(64) NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"agent" text NOT NULL,
	"model" text,
	"face_value_cents" integer,
	"hidden_cost_cents" integer,
	"true_value_cents" integer,
	"min_purchase_cents" integer,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"renewal_price_cents" integer,
	"deadline_date" date,
	"expired" boolean DEFAULT false NOT NULL,
	"claim_window_days" integer,
	"payout_wait_days_min" integer,
	"payout_wait_days_max" integer,
	"steps_count" integer,
	"effort_level" text,
	"effort_minutes_estimate" integer,
	"mail_in" boolean DEFAULT false NOT NULL,
	"needs_receipt" boolean DEFAULT false NOT NULL,
	"needs_phone_call" boolean DEFAULT false NOT NULL,
	"account_required" boolean DEFAULT false NOT NULL,
	"limited_stock" boolean DEFAULT false NOT NULL,
	"regions_excluded" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"catch_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" text NOT NULL,
	"status" text NOT NULL,
	"rule_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"catch_summary" text DEFAULT '' NOT NULL,
	"evidence_quote" text DEFAULT '' NOT NULL,
	"injection_detected" boolean DEFAULT false NOT NULL,
	"recall_status" text DEFAULT 'none_found' NOT NULL,
	"recall_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recall_checked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"store" text NOT NULL,
	"min_age_days" integer NOT NULL,
	"max_age_days" integer NOT NULL,
	"trigger_keyword" text DEFAULT '' NOT NULL,
	"value_cents" integer,
	"fine_print" text DEFAULT '' NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poverty_guidelines" (
	"household_size" integer PRIMARY KEY NOT NULL,
	"annual_cents" integer NOT NULL,
	"year" integer NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"store" text NOT NULL,
	"keyword" text NOT NULL,
	"price_cents" integer NOT NULL,
	"observed_at" date NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" varchar NOT NULL,
	"source" text NOT NULL,
	"store" text,
	"seller" text,
	"purchased_on" date,
	"product_name" text NOT NULL,
	"brand" text,
	"model_number" text,
	"lot_code" text,
	"upc" varchar(14),
	"size_text" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_cents" integer,
	"confidence" real,
	"extractor" text,
	"input_hash" text NOT NULL,
	"line_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "purchase_items_family_input_hash_line_unique" UNIQUE("family_id","input_hash","line_index")
);
--> statement-breakpoint
CREATE TABLE "run_results" (
	"run_id" varchar PRIMARY KEY NOT NULL,
	"family_id" varchar NOT NULL,
	"trace_id" varchar,
	"sample_mode" boolean DEFAULT false NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" varchar(2) NOT NULL,
	"year" integer NOT NULL,
	"code" varchar NOT NULL,
	"title" text NOT NULL,
	"amount_cents" integer,
	"window_start_days_from_birth" integer,
	"window_end_days_from_birth" integer,
	"condition" text DEFAULT '' NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "state_programs_state_code_year_unique" UNIQUE("state","code","year")
);
--> statement-breakpoint
CREATE TABLE "store_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"store" text NOT NULL,
	"adjustment_window_days" integer NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"code" varchar NOT NULL,
	"title" text NOT NULL,
	"amount_cents" integer,
	"note" text DEFAULT '' NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "tax_parameters_year_code_unique" UNIQUE("year","code")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"family_id" varchar NOT NULL,
	"date" date NOT NULL,
	"merchant" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'fixture' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zip_states" (
	"zip3" varchar(3) PRIMARY KEY NOT NULL,
	"state" varchar(2) NOT NULL
);
