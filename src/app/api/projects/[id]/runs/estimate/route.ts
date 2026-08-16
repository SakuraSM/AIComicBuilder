import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, shots } from "@/lib/db/schema";
import { getCurrentUserFromRequest } from "@/lib/auth/session";

const STAGE_RATE_ENV: Record<string, string> = {
  frames: "GENERATION_COST_PER_FRAME",
  videos: "GENERATION_COST_PER_VIDEO",
  assembly: "GENERATION_COST_PER_ASSEMBLY",
};

interface EstimateBody {
  episodeId?: string;
  stages?: string[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const body = (await request.json()) as EstimateBody;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const shotFilters = [eq(shots.projectId, projectId)];
  if (body.episodeId) shotFilters.push(eq(shots.episodeId, body.episodeId));
  const [shotCount] = await db
    .select({ value: count() })
    .from(shots)
    .where(and(...shotFilters));

  const requestedStages = Array.isArray(body.stages) ? body.stages : [];
  let total = 0;
  let isAvailable = requestedStages.length > 0;
  const breakdown = requestedStages.map((stage) => {
    const rate = Number(process.env[STAGE_RATE_ENV[stage] ?? ""]);
    if (!Number.isFinite(rate)) isAvailable = false;
    const units = stage === "assembly" ? 1 : shotCount.value;
    const amount = Number.isFinite(rate) ? rate * units : null;
    if (amount !== null) total += amount;
    return { stage, units, unitCost: Number.isFinite(rate) ? rate : null, amount };
  });

  return NextResponse.json({
    currency: process.env.GENERATION_COST_CURRENCY ?? "USD",
    isAvailable,
    amount: isAvailable ? total.toFixed(4) : null,
    shotCount: shotCount.value,
    breakdown,
  });
}
