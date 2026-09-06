import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const commentsTable = pgTable(
  "comments",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
    authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("comments_post_idx").on(table.postId, table.createdAt),
  }),
);

export const insertCommentSchema = createInsertSchema(commentsTable).omit({
  createdAt: true,
});
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;