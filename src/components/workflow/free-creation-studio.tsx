"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Film,
  Loader2,
  Sparkles,
} from "lucide-react";
import { InlineModelPicker } from "@/components/editor/model-selector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FREE_CREATION_MAX_PROMPT_LENGTH,
  requiresFreeCreationPrompt,
  getFreeCreationRequirements,
} from "@/lib/free-creation";
import { FreeCreationHistory } from "./free-creation-history";
import { FreeCreationImageInput } from "./free-creation-image-input";
import { FreeCreationOptions } from "./free-creation-options";
import { FreeCreationResult } from "./free-creation-result";
import { FreeCreationModeSelector } from "./free-creation-mode-selector";
import { useFreeCreation } from "./use-free-creation";

interface FreeCreationStudioProps {
  projectId: string;
}
export function FreeCreationStudio({ projectId }: FreeCreationStudioProps) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const {
    mode,
    selectMode,
    prompt,
    setPrompt,
    firstFrameFiles,
    setFirstFrameFiles,
    lastFrameFiles,
    setLastFrameFiles,
    referenceFiles,
    setReferenceFiles,
    duration,
    setDuration,
    ratio,
    setRatio,
    resolution,
    setResolution,
    generateAudio,
    setGenerateAudio,
    watermark,
    setWatermark,
    seed,
    setSeed,
    isGenerating,
    error,
    creations,
    selectedCreation,
    setSelectedCreation,
    modelProfileId,
    isOfficialSeedance,
    maxDuration,
    supports1080p,
    maxReferenceImages,
    handleSubmit,
    handleCancel,
  } = useFreeCreation({ projectId });

  const requirements = getFreeCreationRequirements(mode);
  const promptRequired = requiresFreeCreationPrompt(mode);

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-8">
      <section aria-labelledby="free-creation-title" className="space-y-5">
        <div className="rounded-3xl border border-[--border-subtle] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 id="free-creation-title" className="font-display text-2xl font-bold text-[--text-primary]">
                {t("freeTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[--text-secondary]">
                {t("freeDescription")}
              </p>
            </div>
            <InlineModelPicker capability="video" />
          </div>

          <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
            <FreeCreationModeSelector mode={mode} onSelect={selectMode} />

            <label htmlFor="free-creation-prompt" className="block space-y-2">
              <span className="flex items-center justify-between text-sm font-semibold text-[--text-primary]">
                <span>
                  {t("freePrompt")}
                  {!promptRequired ? (
                    <span className="ml-1 font-normal text-[--text-muted]">
                      {t("freeOptional")}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-normal tabular-nums text-[--text-muted]">
                  {prompt.length}/{FREE_CREATION_MAX_PROMPT_LENGTH}
                </span>
              </span>
              <Textarea
                id="free-creation-prompt"
                value={prompt}
                maxLength={FREE_CREATION_MAX_PROMPT_LENGTH}
                rows={6}
                aria-invalid={Boolean(promptRequired && error && !prompt.trim())}
                required={promptRequired}
                placeholder={t("freePromptPlaceholder")}
                className="min-h-36 resize-y"
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>

            {requirements.firstFrame || requirements.lastFrame || requirements.references ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {requirements.firstFrame ? (
                  <FreeCreationImageInput
                    id="free-creation-first-frame"
                    label={t("freeFirstFrame")}
                    hint={t("freeImageHint")}
                    files={firstFrameFiles}
                    onFilesChange={setFirstFrameFiles}
                    required
                  />
                ) : null}
                {requirements.lastFrame ? (
                  <FreeCreationImageInput
                    id="free-creation-last-frame"
                    label={t("freeLastFrame")}
                    hint={t("freeImageHint")}
                    files={lastFrameFiles}
                    onFilesChange={setLastFrameFiles}
                    required
                  />
                ) : null}
                {requirements.references ? (
                  <div className="sm:col-span-2">
                    <FreeCreationImageInput
                      id="free-creation-reference-images"
                      label={t("freeReferenceImages")}
                      hint={t("freeReferenceImagesHint", {
                        count: maxReferenceImages,
                      })}
                      files={referenceFiles}
                      onFilesChange={setReferenceFiles}
                      multiple
                      maxFiles={maxReferenceImages}
                      required
                      orderLabel={t("freeImageOrderLabel")}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <FreeCreationOptions
              duration={duration}
              maxDuration={maxDuration}
              onDurationChange={setDuration}
              ratio={ratio}
              onRatioChange={setRatio}
              resolution={resolution}
              supports1080p={supports1080p}
              onResolutionChange={setResolution}
              generateAudio={generateAudio}
              onGenerateAudioChange={setGenerateAudio}
              watermark={watermark}
              onWatermarkChange={setWatermark}
              seed={seed}
              onSeedChange={setSeed}
            />

            {!modelProfileId || !isOfficialSeedance ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p>{!modelProfileId ? t("secureVideoProfileRequired") : t("freeSeedanceRequired")}</p>
                <Link
                  href={`/${locale}/settings`}
                  className="mt-1 inline-flex font-semibold underline underline-offset-2"
                >
                  {t("freeOpenSettings")}
                </Link>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={isGenerating} className="w-full sm:w-auto">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
              {isGenerating ? t("freeGenerating") : t("freeGenerate")}
            </Button>
          </form>
        </div>

        {selectedCreation ? (
          <FreeCreationResult creation={selectedCreation} onCancel={handleCancel} />
        ) : null}
      </section>

      <aside className="rounded-3xl border border-[--border-subtle] bg-white p-5 shadow-sm lg:sticky lg:top-20 lg:self-start">
        <FreeCreationHistory
          creations={creations}
          selectedId={selectedCreation?.id ?? null}
          onSelect={setSelectedCreation}
        />
      </aside>
    </main>
  );
}
