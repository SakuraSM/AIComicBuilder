import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { modelProfiles } from "@/lib/db/schema";
import { id as generateId } from "@/lib/id";
import type { ModelConfigPayload } from "@/lib/ai/provider-factory";
import {
  decryptModelCredentials,
  encryptModelCredentials,
  type ModelCredentials,
} from "./crypto";

export const MODEL_CAPABILITY = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
} as const;

export type ModelCapability =
  (typeof MODEL_CAPABILITY)[keyof typeof MODEL_CAPABILITY];

export interface SaveModelProfileInput {
  id?: string;
  userId: string;
  name: string;
  capability: ModelCapability;
  protocol: string;
  baseUrl: string;
  modelId: string;
  credentials: ModelCredentials;
  isDefault?: boolean;
}

export interface PublicModelProfile {
  id: string;
  name: string;
  capability: ModelCapability;
  protocol: string;
  baseUrl: string;
  modelId: string;
  isDefault: boolean;
  hasCredentials: boolean;
}

function toPublicModelProfile(
  profile: typeof modelProfiles.$inferSelect,
): PublicModelProfile {
  return {
    id: profile.id,
    name: profile.name,
    capability: profile.capability,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    isDefault: profile.isDefault === 1,
    hasCredentials: Boolean(profile.encryptedCredentials),
  };
}

export async function listModelProfiles(userId: string): Promise<PublicModelProfile[]> {
  const profiles = await db
    .select()
    .from(modelProfiles)
    .where(eq(modelProfiles.userId, userId))
    .orderBy(asc(modelProfiles.capability), asc(modelProfiles.name));
  return profiles.map(toPublicModelProfile);
}

export async function saveModelProfile(
  input: SaveModelProfileInput,
): Promise<PublicModelProfile> {
  const encryptedCredentials = encryptModelCredentials(input.credentials);
  const now = new Date();

  if (input.isDefault) {
    await db
      .update(modelProfiles)
      .set({ isDefault: 0, updatedAt: now })
      .where(
        and(
          eq(modelProfiles.userId, input.userId),
          eq(modelProfiles.capability, input.capability),
        ),
      );
  }

  if (input.id) {
    const [updatedProfile] = await db
      .update(modelProfiles)
      .set({
        name: input.name,
        capability: input.capability,
        protocol: input.protocol,
        baseUrl: input.baseUrl,
        modelId: input.modelId,
        encryptedCredentials,
        isDefault: input.isDefault ? 1 : 0,
        updatedAt: now,
      })
      .where(
        and(
          eq(modelProfiles.id, input.id),
          eq(modelProfiles.userId, input.userId),
        ),
      )
      .returning();
    if (!updatedProfile) throw new Error("Model profile not found.");
    return toPublicModelProfile(updatedProfile);
  }

  const [createdProfile] = await db
    .insert(modelProfiles)
    .values({
      id: generateId(),
      userId: input.userId,
      name: input.name,
      capability: input.capability,
      protocol: input.protocol,
      baseUrl: input.baseUrl,
      modelId: input.modelId,
      encryptedCredentials,
      isDefault: input.isDefault ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return toPublicModelProfile(createdProfile);
}

export async function deleteModelProfile(input: {
  id: string;
  userId: string;
}): Promise<boolean> {
  const deleted = await db
    .delete(modelProfiles)
    .where(
      and(
        eq(modelProfiles.id, input.id),
        eq(modelProfiles.userId, input.userId),
      ),
    )
    .returning({ id: modelProfiles.id });
  return deleted.length === 1;
}

export async function resolveModelProfile(input: {
  id: string;
  userId: string;
}): Promise<ModelConfigPayload> {
  const [profile] = await db
    .select()
    .from(modelProfiles)
    .where(
      and(
        eq(modelProfiles.id, input.id),
        eq(modelProfiles.userId, input.userId),
      ),
    );
  if (!profile) throw new Error("Model profile not found.");

  const credentials = decryptModelCredentials(profile.encryptedCredentials);
  const provider = {
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    apiKey: credentials.apiKey,
    secretKey: credentials.secretKey,
  };
  return { [profile.capability]: provider };
}

export async function resolveTaskModelConfig(input: {
  modelProfileId?: string;
  userId?: string;
  legacyModelConfig?: ModelConfigPayload;
}): Promise<ModelConfigPayload | undefined> {
  if (!input.modelProfileId) return input.legacyModelConfig;
  if (!input.userId) {
    throw new Error("A user is required to resolve a model profile.");
  }
  return resolveModelProfile({ id: input.modelProfileId, userId: input.userId });
}
