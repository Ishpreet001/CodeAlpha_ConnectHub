import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const postsTable = pgTable(
  "posts",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    authorIdx: index("posts_author_idx").on(table.authorId),
    createdIdx: index("posts_created_idx").on(table.createdAt),
  }),
);

export const insertPostSchema = createInsertSchema(postsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;