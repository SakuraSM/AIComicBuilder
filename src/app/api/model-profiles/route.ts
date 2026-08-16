import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/session";
import {
  listModelProfiles,
  MODEL_CAPABILITY,
  saveModelProfile,
  type ModelCapability,
} from "@/lib/model-profiles";

interface SaveProfileBody {
  id?: string;
  name?: string;
  capability?: ModelCapability;
  protocol?: string;
  baseUrl?: string;
  modelId?: string;
  apiKey?: string;
  secretKey?: string;
  isDefault?: boolean;
}

const CAPABILITIES = new Set(Object.values(MODEL_CAPABILITY));

export async function GET(request: Request) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listModelProfiles(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as SaveProfileBody;

  if (
    !body.name?.trim() ||
    !body.capability ||
    !CAPABILITIES.has(body.capability) ||
    !body.protocol?.trim() ||
    !body.baseUrl?.trim() ||
    !body.modelId?.trim() ||
    !body.apiKey
  ) {
    return NextResponse.json({ error: "Invalid model profile" }, { status: 400 });
  }

  try {
    const profile = await saveModelProfile({
      id: body.id,
      userId: user.id,
      name: body.name.trim(),
      capability: body.capability,
      protocol: body.protocol.trim(),
      baseUrl: body.baseUrl.trim(),
      modelId: body.modelId.trim(),
      credentials: { apiKey: body.apiKey, secretKey: body.secretKey },
      isDefault: body.isDefault,
    });
    return NextResponse.json(profile, { status: body.id ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save model profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
