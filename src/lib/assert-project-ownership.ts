import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUserFromRequest } from "@/lib/auth/session";

/**
 * Verify that the request's user owns the given project.
 * Returns the project row if owned, otherwise null.
 */
export async function assertProjectOwnership(
  request: Request,
  projectId: string
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return null;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
  return project ?? null;
}
