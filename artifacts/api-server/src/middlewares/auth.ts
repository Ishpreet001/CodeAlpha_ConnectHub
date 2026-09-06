import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "connecthub_session";
const SESSION_DAYS = 30;

export type AuthenticatedRequest = Request & {
  userId?: number;
  isAuthenticated: () => boolean;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  authReq.isAuthenticated = () => typeof authReq.userId === "number";
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    next();
    return;
  }

  void db
    .select({ userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.tokenHash, hashSessionToken(token)),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1)
    .then((rows) => {
      if (rows[0]) authReq.userId = rows[0].userId;
      next();
    })
    .catch((error) => {
      req.log.warn({ err: error }, "Unable to resolve session");
      next();
    });
}

export function requireAuth(req: Request, res: Response): number | null {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

export async function createSession(res: Response, userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function deleteSession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
  }
  res.clearCookie(SESSION_COOKIE);
}