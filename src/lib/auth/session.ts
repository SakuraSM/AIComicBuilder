import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { id as genId } from "@/lib/id";

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "disabled";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}

interface SessionPayload {
  sessionId: string;
  userId: string;
  role: UserRole;
  expiresAt: number;
  token: string;
}

const DEFAULT_COOKIE_NAME = "ai_comic_session";
const DEFAULT_TTL_DAYS = 30;
const COOKIE_PART_COUNT = 6;

export function getAuthCookieName(): string {
  return process.env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME;
}

export function getSessionTtlDays(): number {
  const ttl = Number(process.env.SESSION_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_DAYS;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.DATABASE_URL;
  if (!secret) {
    throw new Error("AUTH_SECRET is required when DATABASE_URL is not configured.");
  }
  return secret;
}

function signPayload(value: string): string {
  return createHmac("sha256", getAuthSecret()).update(value).digest("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function serializeSessionCookie(payload: SessionPayload): string {
  const unsigned = [
    payload.sessionId,
    payload.userId,
    payload.role,
    String(payload.expiresAt),
    payload.token,
  ].join(".");
  return `${unsigned}.${signPayload(unsigned)}`;
}

export function parseSessionCookie(value: string | null | undefined): SessionPayload | null {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== COOKIE_PART_COUNT) return null;

  const [sessionId, userId, role, expiresAtText, token, signature] = parts;
  if (role !== "user" && role !== "admin") return null;

  const unsigned = [sessionId, userId, role, expiresAtText, token].join(".");
  if (signPayload(unsigned) !== signature) return null;

  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  return { sessionId, userId, role, expiresAt, token };
}

export function getSessionPayloadFromRequest(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieName = getAuthCookieName();
  const rawCookie = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`));

  if (!rawCookie) return null;
  return parseSessionCookie(decodeURIComponent(rawCookie.slice(cookieName.length + 1)));
}

export function getUserIdFromSignedRequest(request: Request): string {
  return getSessionPayloadFromRequest(request)?.userId ?? "";
}

export async function createSession(user: AuthUser): Promise<{ cookieValue: string; expiresAt: Date }> {
  const ttlDays = getSessionTtlDays();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const token = randomBytes(32).toString("hex");
  const sessionId = genId();

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  const cookieValue = serializeSessionCookie({
    sessionId,
    userId: user.id,
    role: user.role,
    expiresAt: expiresAt.getTime(),
    token,
  });

  return { cookieValue, expiresAt };
}

export async function getCurrentUserFromRequest(request: Request): Promise<AuthUser | null> {
  const payload = getSessionPayloadFromRequest(request);
  if (!payload) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, payload.sessionId),
        eq(sessions.tokenHash, hashSessionToken(payload.token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, "active"),
      ),
    );

  return row ?? null;
}

export async function getCurrentUserFromCookies(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const payload = parseSessionCookie(cookieStore.get(getAuthCookieName())?.value);
  if (!payload) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, payload.sessionId),
        eq(sessions.tokenHash, hashSessionToken(payload.token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, "active"),
      ),
    );

  return row ?? null;
}

export async function requireAdmin(request: Request): Promise<AuthUser | null> {
  const user = await getCurrentUserFromRequest(request);
  return user?.role === "admin" ? user : null;
}

export async function destroySession(request: Request): Promise<void> {
  const payload = getSessionPayloadFromRequest(request);
  if (!payload) return;
  await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
}
