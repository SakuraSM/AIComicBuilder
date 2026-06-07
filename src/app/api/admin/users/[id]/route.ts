import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";

interface UpdateUserBody {
  role?: "user" | "admin";
  status?: "active" | "disabled";
  username?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as UpdateUserBody;

  const [updated] = await db
    .update(users)
    .set({
      ...(body.role !== undefined && { role: body.role }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.username !== undefined && { username: body.username.trim() }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
