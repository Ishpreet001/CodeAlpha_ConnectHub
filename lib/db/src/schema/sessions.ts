import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sessionsTable = pgTable(
  "sessions",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
  }),
);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  createdAt: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;