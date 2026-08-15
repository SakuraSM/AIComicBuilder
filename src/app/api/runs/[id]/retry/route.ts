import { NextResponse } from "next/server";
import { retryFailedGenerationRun } from "@/lib/generation-runs";
import { getCurrentUserFromRequest } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const didRetry = await retryFailedGenerationRun({ id, userId: user.id });
  if (!didRetry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ retried: true });
}
