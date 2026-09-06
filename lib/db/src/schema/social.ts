import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { commentsTable } from "./comments";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const likesTable = pgTable(
  "likes",
  {
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.postId] }),
    postIdx: index("likes_post_idx").on(table.postId),
  }),
);

export const followsTable = pgTable(
  "follows",
  {
    followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    followingId: integer("following_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.followerId, table.followingId] }),
    followingIdx: index("follows_following_idx").on(table.followingId),
  }),
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    postId: integer("post_id").references(() => postsTable.id, { onDelete: "cascade" }),
    commentId: integer("comment_id").references(() => commentsTable.id, { onDelete: "cascade" }),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId, table.createdAt),
  }),
);

export const insertLikeSchema = createInsertSchema(likesTable).omit({ createdAt: true });
export const insertFollowSchema = createInsertSchema(followsTable).omit({ createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  createdAt: true,
});
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Like = typeof likesTable.$inferSelect;
export type Follow = typeof followsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;