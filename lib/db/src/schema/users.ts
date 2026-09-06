import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "users",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;