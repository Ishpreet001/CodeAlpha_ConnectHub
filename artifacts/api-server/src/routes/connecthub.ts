import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  CreateCommentBody,
  CreatePostBody,
  DeleteCommentParams,
  DeletePostParams,
  FollowUserParams,
  GetCommentsParams,
  GetFeedQueryParams,
  GetNotificationsQueryParams,
  GetUserPostsParams,
  GetUserProfileParams,
  LikePostParams,
  LoginBody,
  ProfileUpdate,
  RegisterBody,
  SearchUsersQueryParams,
  UnfollowUserParams,
  UnlikePostParams,
  UpdateMeBody,
  UpdatePostBody,
  UpdatePostParams,
} from "@workspace/api-zod";
import {
  commentsTable,
  db,
  followsTable,
  likesTable,
  notificationsTable,
  postsTable,
  usersTable,
} from "@workspace/db";
import { createSession, deleteSession, hashPassword, requireAuth, verifyPassword } from "../middlewares/auth";

const router: IRouter = Router();

type UserRow = typeof usersTable.$inferSelect;

function summary(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio || null,
  };
}

async function profile(username: string, currentUserId?: number) {
  const rows = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  const user = rows[0];
  if (!user) return null;

  const [followers, following, posts, relationship] = await Promise.all([
    db.select({ value: count() }).from(followsTable).where(eq(followsTable.followingId, user.id)),
    db.select({ value: count() }).from(followsTable).where(eq(followsTable.followerId, user.id)),
    db.select({ value: count() }).from(postsTable).where(eq(postsTable.authorId, user.id)),
    currentUserId && currentUserId !== user.id
      ? db
          .select({ value: count() })
          .from(followsTable)
          .where(and(eq(followsTable.followerId, currentUserId), eq(followsTable.followingId, user.id)))
      : Promise.resolve([{ value: 0 }]),
  ]);

  return {
    ...summary(user),
    followersCount: Number(followers[0]?.value ?? 0),
    followingCount: Number(following[0]?.value ?? 0),
    postsCount: Number(posts[0]?.value ?? 0),
    isFollowing: Number(relationship[0]?.value ?? 0) > 0,
    joinedAt: user.createdAt.toISOString(),
  };
}

async function postView(postId: number, currentUserId?: number) {
  const rows = await db
    .select({ post: postsTable, author: usersTable })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.id, postId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [likes, comments, mine] = await Promise.all([
    db.select({ value: count() }).from(likesTable).where(eq(likesTable.postId, postId)),
    db.select({ value: count() }).from(commentsTable).where(eq(commentsTable.postId, postId)),
    currentUserId
      ? db
          .select({ value: count() })
          .from(likesTable)
          .where(and(eq(likesTable.postId, postId), eq(likesTable.userId, currentUserId)))
      : Promise.resolve([{ value: 0 }]),
  ]);

  return {
    id: row.post.id,
    author: summary(row.author),
    content: row.post.content,
    imageUrl: row.post.imageUrl,
    likesCount: Number(likes[0]?.value ?? 0),
    commentsCount: Number(comments[0]?.value ?? 0),
    isLiked: Number(mine[0]?.value ?? 0) > 0,
    createdAt: row.post.createdAt.toISOString(),
    updatedAt: row.post.updatedAt.toISOString(),
  };
}

async function postsFeed(postIds: number[], currentUserId?: number) {
  const items = await Promise.all(postIds.map((id) => postView(id, currentUserId)));
  return { items: items.filter((item): item is NonNullable<typeof item> => Boolean(item)), nextCursor: null };
}

async function notificationActor(actorId: number) {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1);
  return rows[0] ? summary(rows[0]) : null;
}

router.get("/auth/session", async (req, res) => {
  const userId = (req as Request & { userId?: number }).userId;
  const rows = userId
    ? await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1)
    : [];
  const user = rows[0] ? await profile(rows[0].username, userId) : null;
  res.json({ authenticated: Boolean(user), user });
  return;
});

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check your name, username, email, and password." });
  const data = parsed.data;
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.email, data.email.toLowerCase()), eq(usersTable.username, data.username.toLowerCase())))
    .limit(1);
  if (existing[0]) return res.status(409).json({ error: "That email or username is already in use." });

  const [user] = await db
    .insert(usersTable)
    .values({
      name: data.name.trim(),
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      passwordHash: await hashPassword(data.password),
    })
    .returning();
  await createSession(res, user.id);
  res.status(201).json({ authenticated: true, user: await profile(user.username, user.id) });
  return;
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password." });
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email.toLowerCase())).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  await createSession(res, user.id);
  res.json({ authenticated: true, user: await profile(user.username, user.id) });
  return;
});

router.post("/auth/logout", async (req, res) => {
  await deleteSession(req, res);
  res.status(204).end();
  return;
});

router.get("/feed", async (req, res) => {
  const parsed = GetFeedQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid feed parameters." });
  const userId = (req as Request & { userId?: number }).userId;
  let ids: number[] = [];
  if (userId) {
    const follows = await db.select({ id: followsTable.followingId }).from(followsTable).where(eq(followsTable.followerId, userId));
    const authors = [userId, ...follows.map((row) => row.id)];
    const rows = await db.select({ id: postsTable.id }).from(postsTable).where(inArray(postsTable.authorId, authors)).orderBy(desc(postsTable.createdAt)).limit(parsed.data.limit);
    ids = rows.map((row) => row.id);
  } else {
    const rows = await db.select({ id: postsTable.id }).from(postsTable).orderBy(desc(postsTable.createdAt)).limit(parsed.data.limit);
    ids = rows.map((row) => row.id);
  }
  res.json(await postsFeed(ids, userId));
  return;
});

router.get("/discover", async (req, res) => {
  const userId = (req as Request & { userId?: number }).userId;
  const posts = await db.select({ id: postsTable.id }).from(postsTable).orderBy(desc(postsTable.createdAt)).limit(6);
  const users = await db.select().from(usersTable).where(userId ? sql`${usersTable.id} <> ${userId}` : undefined).orderBy(asc(usersTable.name)).limit(5);
  res.json({ trending: (await postsFeed(posts.map((row) => row.id), userId)).items, suggestions: users.map(summary) });
  return;
});

router.get("/users/search", async (req, res) => {
  const parsed = SearchUsersQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Enter a search term." });
  const term = `%${parsed.data.q}%`;
  const users = await db
    .select()
    .from(usersTable)
    .where(or(ilike(usersTable.name, term), ilike(usersTable.username, term)))
    .orderBy(asc(usersTable.name))
    .limit(parsed.data.limit);
  res.json(users.map(summary));
  return;
});

router.get("/users/me", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0] ? await profile(users[0].username, userId) : null;
  if (!user) return res.status(404).json({ error: "Profile not found." });
  res.json(user);
  return;
});

router.patch("/users/me", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid profile details." });
  const changes = parsed.data;
  const [updated] = await db.update(usersTable).set(changes).where(eq(usersTable.id, userId)).returning();
  res.json(await profile(updated.username, userId));
  return;
});

router.get("/users/:username", async (req, res) => {
  const parsed = GetUserProfileParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid username." });
  const userId = (req as Request & { userId?: number }).userId;
  const user = await profile(parsed.data.username, userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
  return;
});

router.get("/users/:username/posts", async (req, res) => {
  const parsed = GetUserPostsParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid username." });
  const users = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, parsed.data.username)).limit(1);
  if (!users[0]) return res.status(404).json({ error: "User not found." });
  const userId = (req as Request & { userId?: number }).userId;
  const rows = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.authorId, users[0].id)).orderBy(desc(postsTable.createdAt));
  res.json(await postsFeed(rows.map((row) => row.id), userId));
  return;
});

router.post("/users/:username/follow", async (req, res) => {
  const followerId = requireAuth(req, res);
  if (!followerId) return;
  const parsed = FollowUserParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid username." });
  const users = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username)).limit(1);
  const target = users[0];
  if (!target || target.id === followerId) return res.status(400).json({ error: "You cannot follow this user." });
  await db.insert(followsTable).values({ followerId, followingId: target.id }).onConflictDoNothing();
  await db.insert(notificationsTable).values({ userId: target.id, actorId: followerId, type: "follow", message: "started following you" });
  const followers = await db.select({ value: count() }).from(followsTable).where(eq(followsTable.followingId, target.id));
  res.json({ following: true, followersCount: Number(followers[0]?.value ?? 0) });
  return;
});

router.delete("/users/:username/follow", async (req, res) => {
  const followerId = requireAuth(req, res);
  if (!followerId) return;
  const parsed = UnfollowUserParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid username." });
  const users = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, parsed.data.username)).limit(1);
  if (!users[0]) return res.status(404).json({ error: "User not found." });
  await db.delete(followsTable).where(and(eq(followsTable.followerId, followerId), eq(followsTable.followingId, users[0].id)));
  const followers = await db.select({ value: count() }).from(followsTable).where(eq(followsTable.followingId, users[0].id));
  res.json({ following: false, followersCount: Number(followers[0]?.value ?? 0) });
  return;
});

router.post("/posts", async (req, res) => {
  const authorId = requireAuth(req, res);
  if (!authorId) return;
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Write something before posting." });
  const [post] = await db.insert(postsTable).values({ ...parsed.data, authorId }).returning({ id: postsTable.id });
  const view = await postView(post.id, authorId);
  res.status(201).json(view);
  return;
});

router.patch("/posts/:postId", async (req, res) => {
  const authorId = requireAuth(req, res);
  if (!authorId) return;
  const params = UpdatePostParams.safeParse(req.params);
  const body = UpdatePostBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid post." });
  const [updated] = await db.update(postsTable).set({ ...body.data, updatedAt: new Date() }).where(and(eq(postsTable.id, params.data.postId), eq(postsTable.authorId, authorId))).returning({ id: postsTable.id });
  if (!updated) return res.status(404).json({ error: "Post not found." });
  res.json(await postView(updated.id, authorId));
  return;
});

router.delete("/posts/:postId", async (req, res) => {
  const authorId = requireAuth(req, res);
  if (!authorId) return;
  const params = DeletePostParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid post." });
  const deleted = await db.delete(postsTable).where(and(eq(postsTable.id, params.data.postId), eq(postsTable.authorId, authorId))).returning({ id: postsTable.id });
  if (!deleted[0]) return res.status(404).json({ error: "Post not found." });
  res.status(204).end();
  return;
});

router.post("/posts/:postId/like", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const params = LikePostParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid post." });
  const post = await db.select().from(postsTable).where(eq(postsTable.id, params.data.postId)).limit(1);
  if (!post[0]) return res.status(404).json({ error: "Post not found." });
  await db.insert(likesTable).values({ userId, postId: params.data.postId }).onConflictDoNothing();
  if (post[0].authorId !== userId) await db.insert(notificationsTable).values({ userId: post[0].authorId, actorId: userId, type: "like", message: "liked your post", postId: post[0].id });
  const likes = await db.select({ value: count() }).from(likesTable).where(eq(likesTable.postId, params.data.postId));
  res.json({ liked: true, likesCount: Number(likes[0]?.value ?? 0) });
  return;
});

router.delete("/posts/:postId/like", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const params = UnlikePostParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid post." });
  await db.delete(likesTable).where(and(eq(likesTable.userId, userId), eq(likesTable.postId, params.data.postId)));
  const likes = await db.select({ value: count() }).from(likesTable).where(eq(likesTable.postId, params.data.postId));
  res.json({ liked: false, likesCount: Number(likes[0]?.value ?? 0) });
  return;
});

router.get("/posts/:postId/comments", async (req, res) => {
  const params = GetCommentsParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid post." });
  const rows = await db.select({ comment: commentsTable, author: usersTable }).from(commentsTable).innerJoin(usersTable, eq(commentsTable.authorId, usersTable.id)).where(eq(commentsTable.postId, params.data.postId)).orderBy(asc(commentsTable.createdAt));
  res.json(rows.map((row) => ({ id: row.comment.id, author: summary(row.author), content: row.comment.content, createdAt: row.comment.createdAt.toISOString() })));
  return;
});

router.post("/posts/:postId/comments", async (req, res) => {
  const authorId = requireAuth(req, res);
  if (!authorId) return;
  const params = GetCommentsParams.safeParse(req.params);
  const body = CreateCommentBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Write a comment first." });
  const posts = await db.select().from(postsTable).where(eq(postsTable.id, params.data.postId)).limit(1);
  if (!posts[0]) return res.status(404).json({ error: "Post not found." });
  const [comment] = await db.insert(commentsTable).values({ postId: params.data.postId, authorId, content: body.data.content }).returning();
  if (posts[0].authorId !== authorId) await db.insert(notificationsTable).values({ userId: posts[0].authorId, actorId: authorId, type: "comment", message: "commented on your post", postId: posts[0].id, commentId: comment.id });
  const authors = await db.select().from(usersTable).where(eq(usersTable.id, authorId)).limit(1);
  res.status(201).json({ id: comment.id, author: summary(authors[0]), content: comment.content, createdAt: comment.createdAt.toISOString() });
  return;
});

router.delete("/comments/:commentId", async (req, res) => {
  const authorId = requireAuth(req, res);
  if (!authorId) return;
  const params = DeleteCommentParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid comment." });
  const deleted = await db.delete(commentsTable).where(and(eq(commentsTable.id, params.data.commentId), eq(commentsTable.authorId, authorId))).returning({ id: commentsTable.id });
  if (!deleted[0]) return res.status(404).json({ error: "Comment not found." });
  res.status(204).end();
  return;
});

router.get("/notifications", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = GetNotificationsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid notification parameters." });
  const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, userId)).orderBy(desc(notificationsTable.createdAt)).limit(parsed.data.limit);
  const result = await Promise.all(rows.map(async (notification) => ({
    id: notification.id,
    type: notification.type as "like" | "comment" | "follow",
    message: notification.message,
    actor: (await notificationActor(notification.actorId)) ?? { id: notification.actorId, name: "Someone", username: "someone", avatarUrl: null, bio: null },
    postId: notification.postId,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  })));
  res.json(result);
  return;
});

export default router;