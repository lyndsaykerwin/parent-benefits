import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";

// Guest-only app: nothing requires a signed-in user. The users table is kept
// (minimal) so later tasks can attach a family profile to it if they want.
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
