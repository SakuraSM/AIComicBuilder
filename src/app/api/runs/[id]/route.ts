import { NextResponse } from "next/server";
import {
  cancelGenerationRun,
  getGenerationRun,
} from "@/lib/generation-runs";
import { getCurrentUserFromRequest } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const run = await getGenerationRun({ id, userId: user.id });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(run);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const didCancel = await cancelGenerationRun({ id, userId: user.id });
  if (!didCancel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ cancelled: true });
}
