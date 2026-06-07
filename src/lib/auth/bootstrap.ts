import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { id as genId } from "@/lib/id";
import { hashPassword } from "./password";

export async function ensureInitialAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) return;

  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail));

  if (existing) return;

  await db.insert(users).values({
    id: genId(),
    email: normalizedEmail,
    username: normalizedEmail.split("@")[0] || "admin",
    passwordHash: hashPassword(password),
    role: "admin",
    status: "active",
  });

  console.log(`[Auth] Initial admin created for ${normalizedEmail}`);
}
