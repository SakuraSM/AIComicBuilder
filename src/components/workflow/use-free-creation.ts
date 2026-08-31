"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";
import {
  FREE_CREATION_MODE,
  FREE_CREATION_MAX_IMAGE_BYTES,
  FREE_CREATION_MAX_UPLOAD_BYTES,
  FREE_CREATION_STATUS,
  getFreeCreationRequirements,
  requiresFreeCreationPrompt,
  type FreeCreationMode,
  type FreeCreationRatio,
  type FreeCreationResolution,
  type FreeCreationSummary,
} from "@/lib/free-creation";
import { useModelStore } from "@/stores/model-store";
import { getSeedanceModelCapabilities } from "@/lib/ai/model-limits";
import type { UseFreeCreationResult } from "./free-creation-hook-types";

interface UseFreeCreationInput {
  projectId: string;
}

const DEFAULT_DURATION_SECONDS = 5;
const FREE_CREATION_POLL_INTERVAL_MS = 3_000;

export function useFreeCreation({
  projectId,
}: UseFreeCreationInput): UseFreeCreationResult {
  const t = useTranslations("studio");
  const providers = useModelStore((state) => state.providers);
  const defaultVideoModel = useModelStore((state) => state.defaultVideoModel);
  const selectedProvider = providers.find(
    (provider) => provider.id === defaultVideoModel?.providerId,
  );
  const modelProfileId = selectedProvider?.serverProfileId;
  const isOfficialSeedance = selectedProvider?.protocol === "seedance";
  const selectedModelId = defaultVideoModel?.modelId;
  const capabilities = getSeedanceModelCapabilities(selectedModelId);
  const maxDuration = capabilities.maxDuration;
  const supports1080p = capabilities.supportedResolutions.includes("1080p");
  const maxReferenceImages = capabilities.maxReferenceImages;

  const [mode, setMode] = useState<FreeCreationMode>(FREE_CREATION_MODE.TEXT);
  const [prompt, setPrompt] = useState("");
  const [firstFrameFiles, setFirstFrameFiles] = useState<File[]>([]);
  const [lastFrameFiles, setLastFrameFiles] = useState<File[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [duration, setDuration] = useState(DEFAULT_DURATION_SECONDS);
  const [ratio, setRatio] = useState<FreeCreationRatio>("adaptive");
  const [resolution, setResolution] = useState<FreeCreationResolution>("720p");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [seed, setSeed] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creations, setCreations] = useState<FreeCreationSummary[]>([]);
  const [selectedCreation, setSelectedCreation] = useState<FreeCreationSummary | null>(null);
  const knownStatusesRef = useRef(new Map<string, FreeCreationSummary["status"]>());
  const hasLoadedHistoryRef = useRef(false);
  const hasActiveCreations = creations.some(
    (creation) =>
      creation.status === FREE_CREATION_STATUS.PENDING ||
      creation.status === FREE_CREATION_STATUS.RUNNING,
  );

  useEffect(() => {
    if (duration > maxDuration) setDuration(maxDuration);
  }, [duration, maxDuration]);

  useEffect(() => {
    if (!supports1080p && resolution === "1080p") setResolution("720p");
  }, [resolution, supports1080p]);

  useEffect(() => {
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    async function loadHistory(): Promise<void> {
      try {
        const response = await apiFetch(
          `/api/projects/${projectId}/free-creations`,
          { signal: abortController.signal },
        );
        const history = (await response.json()) as FreeCreationSummary[];
        if (hasLoadedHistoryRef.current) {
          for (const creation of history) {
            const previousStatus = knownStatusesRef.current.get(creation.id);
            if (
              previousStatus &&
              previousStatus !== creation.status &&
              creation.status === FREE_CREATION_STATUS.SUCCEEDED
            ) {
              toast.success(t("freeGenerationCompleted"));
            }
            if (
              previousStatus &&
              previousStatus !== creation.status &&
              creation.status === FREE_CREATION_STATUS.FAILED
            ) {
              toast.error(creation.error ?? t("freeGenerationFailed"));
            }
          }
        }
        knownStatusesRef.current = new Map(
          history.map((creation) => [creation.id, creation.status]),
        );
        hasLoadedHistoryRef.current = true;
        setCreations(history);
        setSelectedCreation((current) =>
          (current ? history.find((creation) => creation.id === current.id) : null) ??
          history.find((creation) => creation.videoUrl !== null) ??
          history[0] ??
          null,
        );
        if (
          history.some(
            (creation) =>
              creation.status === FREE_CREATION_STATUS.PENDING ||
              creation.status === FREE_CREATION_STATUS.RUNNING,
          )
        ) {
          timeoutId = setTimeout(
            () => void loadHistory(),
            FREE_CREATION_POLL_INTERVAL_MS,
          );
        }
      } catch (loadError) {
        if (!abortController.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : t("freeHistoryFailed"),
          );
        }
      }
    }
    void loadHistory();
    return () => {
      abortController.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasActiveCreations, projectId, t]);

  function selectMode(nextMode: FreeCreationMode): void {
    setMode(nextMode);
    setError(null);
  }

  function validateForm(): string | null {
    const requirements = getFreeCreationRequirements(mode);
    if (requiresFreeCreationPrompt(mode) && !prompt.trim()) {
      return t("freePromptRequired");
    }
    if (!modelProfileId) return t("secureVideoProfileRequired");
    if (!isOfficialSeedance) return t("freeSeedanceRequired");
    if (requirements.firstFrame && firstFrameFiles.length === 0) {
      return t("freeFirstFrameRequired");
    }
    if (requirements.lastFrame && lastFrameFiles.length === 0) {
      return t("freeLastFrameRequired");
    }
    if (requirements.references && referenceFiles.length === 0) {
      return t("freeReferenceRequired");
    }
    const files = [...firstFrameFiles, ...lastFrameFiles, ...referenceFiles];
    if (files.some((file) => file.size > FREE_CREATION_MAX_IMAGE_BYTES)) {
      return t("freeImageTooLarge");
    }
    if (files.reduce((total, file) => total + file.size, 0) > FREE_CREATION_MAX_UPLOAD_BYTES) {
      return t("freeUploadTooLarge");
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.set("prompt", prompt.trim());
    formData.set("mode", mode);
    formData.set("modelProfileId", modelProfileId ?? "");
    formData.set("duration", String(duration));
    formData.set("ratio", ratio);
    formData.set("resolution", resolution);
    formData.set("generateAudio", String(generateAudio));
    formData.set("watermark", String(watermark));
    if (seed.trim()) formData.set("seed", seed.trim());
    if (firstFrameFiles[0]) formData.set("firstFrame", firstFrameFiles[0]);
    if (lastFrameFiles[0]) formData.set("lastFrame", lastFrameFiles[0]);
    referenceFiles.forEach((file) => formData.append("referenceImages", file));

    setIsGenerating(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/projects/${projectId}/free-creations`,
        { method: "POST", body: formData },
      );
      const creation = (await response.json()) as FreeCreationSummary;
      setCreations((current) => [
        creation,
        ...current.filter((item) => item.id !== creation.id),
      ]);
      setSelectedCreation(creation);
      knownStatusesRef.current.set(creation.id, creation.status);
      toast.success(t("freeGenerationQueued"));
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : t("freeGenerationFailed");
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCancel(creation: FreeCreationSummary): Promise<void> {
    try {
      await apiFetch(
        `/api/projects/${projectId}/free-creations/${creation.id}`,
        { method: "DELETE" },
      );
      const cancelledCreation = {
        ...creation,
        status: FREE_CREATION_STATUS.CANCELLED,
      };
      knownStatusesRef.current.set(creation.id, FREE_CREATION_STATUS.CANCELLED);
      setCreations((current) =>
        current.map((item) => item.id === creation.id ? cancelledCreation : item),
      );
      setSelectedCreation((current) =>
        current?.id === creation.id ? cancelledCreation : current,
      );
      toast.success(t("freeGenerationCancelled"));
    } catch (cancelError) {
      const message = cancelError instanceof Error
        ? cancelError.message
        : t("freeCancelFailed");
      setError(message);
      toast.error(message);
    }
  }

  return {
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
  };
}
