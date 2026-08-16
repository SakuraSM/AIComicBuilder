import { NextResponse } from "next/server";
import { destroySession, getAuthCookieName } from "@/lib/auth/session";

export async function POST(request: Request) {
  await destroySession(request);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
