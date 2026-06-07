import { NextResponse } from "next/server";
import { or, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, getAuthCookieName } from "@/lib/auth/session";

interface LoginBody {
  login?: string;
  password?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const login = body.login?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!login || !password) {
    return NextResponse.json({ error: "Missing login or password" }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, login), eq(users.username, login)));

  if (!user || user.status !== "active" || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { cookieValue, expiresAt } = await createSession(user);
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  });

  response.cookies.set(getAuthCookieName(), cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}
