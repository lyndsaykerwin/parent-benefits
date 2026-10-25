import {
  pgTable, text, varchar, timestamp, integer, boolean, date, serial, real, jsonb, unique,
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
  // V2 onboarding answers (all optional so older rows keep working).
  household: text("household", { enum: ["one", "two"] }),
  parent1Work: text("parent1_work", { enum: ["paycheck", "self_employed", "not_working"] }),
  parent2Work: text("parent2_work", { enum: ["paycheck", "self_employed", "not_working"] }),
  insurance: text("insurance", { enum: ["job", "marketplace", "medicaid", "tricare", "none_or_not_sure"] }),
  savedAt: timestamp("saved_at"),
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
  /** "federal" (everyone) or a 2-letter state code (that state only). */
  scope: text("scope").notNull(),
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
  kind: text("kind", { enum: ["got_it", "issue", "not_relevant"] }).notNull(),
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

// ---------------------------------------------------------------------------
// Plan v3 tables (W1-DB). See bundle-plan-v3.md sections 1, 3 and 6.
// ---------------------------------------------------------------------------

/**
 * One structured purchase-items table for every intake path (email, barcode,
 * photo). Agents read it only through the Zetaris safe-columns view
 * v_purchase_items. `input_hash` + `line_index` stop the same receipt/photo line
 * counting twice, while still allowing many items from one receipt/photo.
 */
export const purchaseItems = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  familyId: varchar("family_id").notNull(),
  source: text("source", { enum: ["email", "barcode", "photo_item", "photo_receipt"] }).notNull(),
  store: text("store"),
  seller: text("seller"),
  purchasedOn: date("purchased_on", { mode: "string" }),
  productName: text("product_name").notNull(),
  brand: text("brand"),
  modelNumber: text("model_number"),
  lotCode: text("lot_code"),
  upc: varchar("upc", { length: 14 }),
  sizeText: text("size_text"),
  quantity: integer("quantity").notNull().default(1),
  priceCents: integer("price_cents"),
  confidence: real("confidence"),
  extractor: text("extractor"),
  inputHash: text("input_hash").notNull(),
  /** 0-based position of this item within its source receipt/photo. */
  lineIndex: integer("line_index").notNull().default(0),
  /** Points at item_photos.id when the item came from a saved gear/receipt photo. */
  photoId: integer("photo_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [unique("purchase_items_family_input_hash_line_unique").on(t.familyId, t.inputHash, t.lineIndex)]);

/**
 * One row per judged offer (the Living Fine-Print Database). NO family column:
 * the same rows feed the agents' future grading and v_offer_audit.
 */
export const offerChecks = pgTable("offer_checks", {
  id: serial("id").primaryKey(),
  // Identity
  offerId: varchar("offer_id").notNull(),
  store: text("store").notNull(),
  sourceUrl: text("source_url"),
  finePrintHash: varchar("fine_print_hash", { length: 64 }).notNull(),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
  agent: text("agent").notNull(),
  model: text("model"),
  // Money
  faceValueCents: integer("face_value_cents"),
  hiddenCostCents: integer("hidden_cost_cents"),
  trueValueCents: integer("true_value_cents"),
  minPurchaseCents: integer("min_purchase_cents"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  renewalPriceCents: integer("renewal_price_cents"),
  // Dates / time to get the value
  deadlineDate: date("deadline_date", { mode: "string" }),
  expired: boolean("expired").notNull().default(false),
  claimWindowDays: integer("claim_window_days"),
  payoutWaitDaysMin: integer("payout_wait_days_min"),
  payoutWaitDaysMax: integer("payout_wait_days_max"),
  // Effort
  stepsCount: integer("steps_count"),
  effortLevel: text("effort_level", { enum: ["low", "medium", "high"] }),
  effortMinutesEstimate: integer("effort_minutes_estimate"),
  mailIn: boolean("mail_in").notNull().default(false),
  needsReceipt: boolean("needs_receipt").notNull().default(false),
  needsPhoneCall: boolean("needs_phone_call").notNull().default(false),
  accountRequired: boolean("account_required").notNull().default(false),
  // Availability
  limitedStock: boolean("limited_stock").notNull().default(false),
  regionsExcluded: jsonb("regions_excluded").$type<string[]>().notNull().default([]),
  // Judgment
  catchTypes: jsonb("catch_types").$type<string[]>().notNull().default([]),
  verdict: text("verdict").notNull(),
  status: text("status").notNull(),
  ruleCitations: jsonb("rule_citations").$type<string[]>().notNull().default([]),
  catchSummary: text("catch_summary").notNull().default(""),
  evidenceQuote: text("evidence_quote").notNull().default(""),
  injectionDetected: boolean("injection_detected").notNull().default(false),
  // Recall status (Strategy 2)
  recallStatus: text("recall_status", { enum: ["none_found", "open_recall", "finished"] }).notNull().default("none_found"),
  recallIds: jsonb("recall_ids").$type<string[]>().notNull().default([]),
  recallCheckedAt: timestamp("recall_checked_at"),
  /** 'court' = graded by our own scan; 'user_audit' = a parent pasted it into Audit-a-deal. */
  source: text("source", { enum: ["court", "user_audit"] }).notNull().default("court"),
});

/** Saved run results so a run is still served after a server restart. */
export const runResults = pgTable("run_results", {
  runId: varchar("run_id").primaryKey(),
  familyId: varchar("family_id").notNull(),
  traceId: varchar("trace_id"),
  sampleMode: boolean("sample_mode").notNull().default(false),
  result: jsonb("result").$type<unknown>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Gear and receipt photos a family chose to keep (thumbnail and receipt image stored as text, e.g. data URLs). */
export const itemPhotos = pgTable("item_photos", {
  id: serial("id").primaryKey(),
  familyId: varchar("family_id").notNull(),
  kind: text("kind", { enum: ["gear", "receipt"] }),
  thumbnail: text("thumbnail"),
  receiptImage: text("receipt_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** One row per card a parent marked "I got this" or "Not relevant" (latest wins per family + card). */
export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  familyId: varchar("family_id").notNull(),
  cardId: varchar("card_id").notNull(),
  status: text("status", { enum: ["got_it", "not_relevant"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [unique("claims_family_card_unique").on(t.familyId, t.cardId)]);

/** Federal tax/benefit figures (e.g. IRS 2026 Child Tax Credit), one per year + code, with source link. */
export const taxParameters = pgTable("tax_parameters", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  code: varchar("code").notNull(),
  title: text("title").notNull(),
  amountCents: integer("amount_cents"),
  note: text("note").notNull().default(""),
  sourceUrl: text("source_url").notNull(),
}, (t) => [unique("tax_parameters_year_code_unique").on(t.year, t.code)]);

/** State programs (paid family leave, state child credits), one per state + code + year, with source link. */
export const statePrograms = pgTable("state_programs", {
  id: serial("id").primaryKey(),
  state: varchar("state", { length: 2 }).notNull(),
  year: integer("year").notNull(),
  code: varchar("code").notNull(),
  title: text("title").notNull(),
  amountCents: integer("amount_cents"),
  windowStartDaysFromBirth: integer("window_start_days_from_birth"),
  windowEndDaysFromBirth: integer("window_end_days_from_birth"),
  condition: text("condition").notNull().default(""),
  sourceUrl: text("source_url").notNull(),
}, (t) => [unique("state_programs_state_code_year_unique").on(t.state, t.code, t.year)]);

/** Tables Bundle owns (used by drizzle.config.ts tablesFilter). */
export const BUNDLE_TABLE_NAMES = [
  "users", "families", "transactions", "amazon_orders", "fsa_eligible_categories",
  "store_policies", "benefit_rules", "offers", "feedback", "case_law_proposals",
  "price_observations", "zip_states",
  "purchase_items", "offer_checks", "run_results", "item_photos", "claims", "tax_parameters", "state_programs",
] as const;
