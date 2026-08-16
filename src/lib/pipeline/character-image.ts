import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { resolveImageProvider } from "@/lib/ai/provider-factory";
import type { ModelConfigPayload } from "@/lib/ai/provider-factory";
import { buildCharacterTurnaroundPrompt } from "@/lib/ai/prompts/character-image";
import { eq } from "drizzle-orm";
import type { Task } from "@/lib/task-queue";
import { resolveTaskModelConfig } from "@/lib/model-profiles";

export async function handleCharacterImage(task: Task) {
  const payload = task.payload as {
    characterId: string;
    modelConfig?: ModelConfigPayload;
    modelProfileId?: string;
    userId?: string;
  };

  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, payload.characterId));

  if (!character) {
    throw new Error("Character not found");
  }

  const modelConfig = await resolveTaskModelConfig({
    modelProfileId: payload.modelProfileId,
    userId: payload.userId,
    legacyModelConfig: payload.modelConfig,
  });
  const ai = resolveImageProvider(modelConfig);
  const prompt = buildCharacterTurnaroundPrompt(character.description || character.name, character.name);

  const imagePath = await ai.generateImage(prompt, {
    size: "2560x1440",
    aspectRatio: "16:9",
    quality: "hd",
  });

  await db
    .update(characters)
    .set({ referenceImage: imagePath })
    .where(eq(characters.id, payload.characterId));

  return { imagePath };
}
