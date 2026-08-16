import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { id as genId } from "@/lib/id";

interface CreateUserBody {
  email?: string;
  username?: string;
  password?: string;
  role?: "user" | "admin";
}

const MIN_PASSWORD_LENGTH = 8;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      projectCount: sql<number>`count(${projects.id})`,
    })
    .from(users)
    .leftJoin(projects, eq(projects.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(users.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as CreateUserBody;
  const email = body.email?.trim().toLowerCase();
  const username = body.username?.trim();
  const password = body.password ?? "";
  const role = body.role ?? "user";

  if (!email || !username || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "Email, username, and an 8+ character password are required" },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(users)
    .values({
      id: genId(),
      email,
      username,
      passwordHash: hashPassword(password),
      role,
      status: "active",
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return NextResponse.json(created, { status: 201 });
}
