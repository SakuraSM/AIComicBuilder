import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { modelProfiles, projects } from "@/lib/db/schema";
import {
  createGenerationRun,
  listProjectRuns,
  RUN_MODE,
  type GenerationStageInput,
  type RunMode,
} from "@/lib/generation-runs";
import { getCurrentUserFromRequest } from "@/lib/auth/session";
import { containsSensitiveTaskData } from "@/lib/task-queue";

const MAX_STAGES_PER_RUN = 100;
const ALLOWED_TASK_TYPES = new Set([
  "script_outline",
  "script_parse",
  "character_extract",
  "character_image",
  "shot_split",
  "frame_generate",
  "video_generate",
  "video_assemble",
]);

interface CreateRunBody {
  episodeId?: string;
  mode?: RunMode;
  modelProfileId?: string;
  estimatedCost?: string;
  stages?: GenerationStageInput[];
  dryRun?: boolean;
}

function isGenerationStage(value: unknown): value is GenerationStageInput {
  if (!value || typeof value !== "object") return false;
  const stage = value as Record<string, unknown>;
  return (
    typeof stage.stage === "string" &&
    typeof stage.type === "string" &&
    ALLOWED_TASK_TYPES.has(stage.type) &&
    (stage.payload === undefined ||
      (typeof stage.payload === "object" && stage.payload !== null))
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;

  const projectRuns = await listProjectRuns({ projectId, userId: user.id });
  return NextResponse.json(projectRuns);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const body = (await request.json()) as CreateRunBody;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    !Array.isArray(body.stages) ||
    body.stages.length === 0 ||
    body.stages.length > MAX_STAGES_PER_RUN ||
    !body.stages.every(isGenerationStage) ||
    body.stages.some((stage) => containsSensitiveTaskData(stage.payload))
  ) {
    return NextResponse.json({ error: "Invalid generation stages" }, { status: 400 });
  }

  if (body.modelProfileId) {
    const [profile] = await db
      .select({ id: modelProfiles.id })
      .from(modelProfiles)
      .where(
        and(
          eq(modelProfiles.id, body.modelProfileId),
          eq(modelProfiles.userId, user.id),
        ),
      );
    if (!profile) {
      return NextResponse.json({ error: "Model profile not found" }, { status: 400 });
    }
  }

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      stageCount: body.stages.length,
      stages: body.stages.map((stage) => stage.stage),
      estimatedCost: body.estimatedCost ?? null,
    });
  }

  const run = await createGenerationRun({
    projectId,
    episodeId: body.episodeId,
    userId: user.id,
    mode: body.mode ?? RUN_MODE.GUIDED,
    modelProfileId: body.modelProfileId,
    estimatedCost: body.estimatedCost,
    stages: body.stages,
  });
  return NextResponse.json(run, { status: 201 });
}
