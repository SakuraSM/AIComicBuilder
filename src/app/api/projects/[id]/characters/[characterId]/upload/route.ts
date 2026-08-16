import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { assertProjectOwnership } from "@/lib/assert-project-ownership";
import { putObject } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const { id: projectId, characterId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [character] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)));
  if (!character) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await putObject({
    buffer,
    filename: file.name,
    keyPrefix: `projects/${projectId}/characters/${characterId}`,
    contentType: file.type || undefined,
  });

  // Append to history
  let history: string[] = [];
  try {
    history = JSON.parse(character.referenceImageHistory || "[]");
  } catch {}
  if (character.referenceImage && !history.includes(character.referenceImage)) {
    history.push(character.referenceImage);
  }
  if (!history.includes(stored.url)) {
    history.push(stored.url);
  }

  const [updated] = await db
    .update(characters)
    .set({ referenceImage: stored.url, referenceImageHistory: JSON.stringify(history) })
    .where(eq(characters.id, characterId))
    .returning();

  return NextResponse.json(updated);
}
