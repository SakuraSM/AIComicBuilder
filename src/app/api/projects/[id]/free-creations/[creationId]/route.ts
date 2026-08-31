import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { freeCreations, projects } from "@/lib/db/schema";
import { FREE_CREATION_STATUS } from "@/lib/free-creation";
import { requestTaskCancellation } from "@/lib/task-queue";

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; creationId: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, creationId } = await params;

  const [creation] = await db
    .select({
      id: freeCreations.id,
      taskId: freeCreations.taskId,
      status: freeCreations.status,
    })
    .from(freeCreations)
    .innerJoin(projects, eq(freeCreations.projectId, projects.id))
    .where(
      and(
        eq(freeCreations.id, creationId),
        eq(freeCreations.projectId, projectId),
        eq(freeCreations.userId, user.id),
        eq(projects.userId, user.id),
      ),
    );
  if (!creation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    creation.status === FREE_CREATION_STATUS.SUCCEEDED ||
    creation.status === FREE_CREATION_STATUS.FAILED ||
    creation.status === FREE_CREATION_STATUS.CANCELLED
  ) {
    return NextResponse.json({ status: creation.status });
  }
  if (!creation.taskId) {
    return NextResponse.json({ error: "Generation task is unavailable" }, { status: 409 });
  }

  await requestTaskCancellation(creation.taskId);
  await db
    .update(freeCreations)
    .set({
      status: FREE_CREATION_STATUS.CANCELLED,
      error: "Generation cancellation requested",
      updatedAt: new Date(),
    })
    .where(eq(freeCreations.id, creation.id));
  return NextResponse.json({ status: FREE_CREATION_STATUS.CANCELLED }, { status: 202 });
}
