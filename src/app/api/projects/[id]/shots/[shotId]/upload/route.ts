import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shots } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { assertProjectOwnership } from "@/lib/assert-project-ownership";
import { putObject } from "@/lib/storage";
import {
  getActiveAsset,
  insertAssetVersion,
  type ShotAssetType,
} from "@/lib/shot-asset-utils";

const ALLOWED_FIELDS = ["firstFrame", "lastFrame", "sceneRefFrame", "reference_image"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

const UPLOAD_ASSET_TYPE_BY_FIELD = {
  firstFrame: "first_frame",
  lastFrame: "last_frame",
  sceneRefFrame: "reference",
} as const satisfies Record<Exclude<AllowedField, "reference_image">, ShotAssetType>;

function isAllowedField(field: string): field is AllowedField {
  return (ALLOWED_FIELDS as readonly string[]).includes(field);
}

function isUploadAssetField(
  field: AllowedField
): field is keyof typeof UPLOAD_ASSET_TYPE_BY_FIELD {
  return field !== "reference_image";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; shotId: string }> }
) {
  const { id: projectId, shotId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [shotRow] = await db
    .select({ id: shots.id })
    .from(shots)
    .where(and(eq(shots.id, shotId), eq(shots.projectId, projectId)));
  if (!shotRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const field = formData.get("field") as string | null;

  if (!file || !field) {
    return NextResponse.json({ error: "Missing file or field" }, { status: 400 });
  }
  if (!isAllowedField(field)) {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await putObject({
    buffer,
    filename: file.name,
    keyPrefix: `projects/${projectId}/shots/${shotId}/frames`,
    contentType: file.type || undefined,
  });

  // For reference_image uploads, just return the file path without updating a DB column
  if (!isUploadAssetField(field)) {
    return NextResponse.json({ url: stored.url });
  }

  const assetType = UPLOAD_ASSET_TYPE_BY_FIELD[field];
  const activeAsset = await getActiveAsset(shotId, assetType, 0);
  const updated = await insertAssetVersion({
    shotId,
    type: assetType,
    sequenceInType: 0,
    prompt: activeAsset?.prompt ?? "",
    fileUrl: stored.url,
    status: "completed",
  });

  return NextResponse.json(updated);
}
