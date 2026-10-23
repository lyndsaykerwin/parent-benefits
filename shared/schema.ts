import {
  pgTable, text, varchar, timestamp, integer, boolean, date, serial, real, jsonb,
} from "drizzle-orm/pg-core";

// Every table and column uses an explicit snake_case name because Zetaris
// (the SQL "data door") queries these tables directly with raw SQL.

// Guest-only app: nothing requires a signed-in user. The users table is kept
// (minimal) so later tasks can attach a family profile to it if they want.
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof users.$inferSelect;

export const families = pgTable("families", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id"),
  isGuest: boolean("is_guest").notNull().default(true),
  name: text("name").notNull(),
  birthDate: date("birth_date", { mode: "string" }),
  dueDate: date("due_date", { mode: "string" }),
  zip: varchar("zip", { length: 10 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  employer: text("employer").notNull().default(""),
  householdSize: integer("household_size").notNull().default(3),
  annualIncomeCents: integer("annual_income_cents"),
  dcfsaOffered: boolean("dcfsa_offered").notNull().default(false),
  dataConnected: boolean("data_connected").notNull().default(false),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey(),
  familyId: varchar("family_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  merchant: text("merchant").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull().default(""),
  source: text("source", { enum: ["plaid", "fixture"] }).notNull().default("fixture"),
});

export const amazonOrders = pgTable("amazon_orders", {
  id: varchar("id").primaryKey(),
  familyId: varchar("family_id").notNull(),
  orderDate: date("order_date", { mode: "string" }).notNull(),
  title: text("title").notNull(),
  asin: varchar("asin"),
  upc: varchar("upc"),
  priceCents: integer("price_cents").notNull(),
});

export const fsaEligibleCategories = pgTable("fsa_eligible_categories", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  category: text("category").notNull(),
  account: text("account", { enum: ["FSA", "HSA", "DCFSA"] }).notNull(),
  sourceUrl: text("source_url").notNull(),
});

export const storePolicies = pgTable("store_policies", {
  id: serial("id").primaryKey(),
  store: text("store").notNull(),
  adjustmentWindowDays: integer("adjustment_window_days").notNull(),
  sourceUrl: text("source_url").notNull(),
});

export const benefitRules = pgTable("benefit_rules", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(),
  title: text("title").notNull(),
  scope: text("scope", { enum: ["federal", "MA"] }).notNull(),
  amountCents: integer("amount_cents"),
  windowStartDaysFromBirth: integer("window_start_days_from_birth"),
  windowEndDaysFromBirth: integer("window_end_days_from_birth"),
  condition: text("condition").notNull().default(""),
  sourceUrl: text("source_url").notNull(),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  store: text("store").notNull(),
  minAgeDays: integer("min_age_days").notNull(),
  maxAgeDays: integer("max_age_days").notNull(),
  triggerKeyword: text("trigger_keyword").notNull().default(""),
  valueCents: integer("value_cents"),
  finePrint: text("fine_print").notNull().default(""),
  sourceUrl: text("source_url").notNull(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  familyId: varchar("family_id").notNull(),
  cardId: varchar("card_id").notNull(),
  kind: text("kind", { enum: ["got_it", "issue"] }).notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const caseLawProposals = pgTable("case_law_proposals", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  sourceFeedbackIds: jsonb("source_feedback_ids").$type<number[]>().notNull().default([]),
  confidence: real("confidence").notNull().default(0),
  status: text("status", { enum: ["proposed", "approved", "rejected"] }).notNull().default("proposed"),
  memoryId: text("memory_id"),
});

export const priceObservations = pgTable("price_observations", {
  id: serial("id").primaryKey(),
  store: text("store").notNull(),
  keyword: text("keyword").notNull(),
  priceCents: integer("price_cents").notNull(),
  observedAt: date("observed_at", { mode: "string" }).notNull(),
  sourceUrl: text("source_url").notNull(),
});

export const zipStates = pgTable("zip_states", {
  zip3: varchar("zip3", { length: 3 }).primaryKey(),
  state: varchar("state", { length: 2 }).notNull(),
});

export const povertyGuidelines = pgTable("poverty_guidelines", {
  householdSize: integer("household_size").primaryKey(),
  annualCents: integer("annual_cents").notNull(),
  year: integer("year").notNull(),
  sourceUrl: text("source_url").notNull(),
});

/** Tables Bundle owns (used by drizzle.config.ts tablesFilter). */
export const BUNDLE_TABLE_NAMES = [
  "users", "families", "transactions", "amazon_orders", "fsa_eligible_categories",
  "store_policies", "benefit_rules", "offers", "feedback", "case_law_proposals",
  "price_observations", "zip_states", "poverty_guidelines",
] as const;
