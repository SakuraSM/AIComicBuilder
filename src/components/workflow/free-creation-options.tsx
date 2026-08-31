"use client";

import { useTranslations } from "next-intl";
import {
  FREE_CREATION_DURATION_MAX_SECONDS,
  FREE_CREATION_DURATION_MIN_SECONDS,
  FREE_CREATION_RATIOS,
  FREE_CREATION_RESOLUTIONS,
  type FreeCreationRatio,
  type FreeCreationResolution,
} from "@/lib/free-creation";

interface FreeCreationOptionsProps {
  duration: number;
  maxDuration: number;
  onDurationChange: (duration: number) => void;
  ratio: FreeCreationRatio;
  onRatioChange: (ratio: FreeCreationRatio) => void;
  resolution: FreeCreationResolution;
  supports1080p: boolean;
  onResolutionChange: (resolution: FreeCreationResolution) => void;
  generateAudio: boolean;
  onGenerateAudioChange: (generateAudio: boolean) => void;
  watermark: boolean;
  onWatermarkChange: (watermark: boolean) => void;
  seed: string;
  onSeedChange: (seed: string) => void;
}

const SELECT_CLASS_NAME =
  "h-10 w-full rounded-xl border border-[--border-subtle] bg-white px-3 text-sm text-[--text-primary] outline-none transition-colors focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15";

export function FreeCreationOptions({
  duration,
  maxDuration,
  onDurationChange,
  ratio,
  onRatioChange,
  resolution,
  supports1080p,
  onResolutionChange,
  generateAudio,
  onGenerateAudioChange,
  watermark,
  onWatermarkChange,
  seed,
  onSeedChange,
}: FreeCreationOptionsProps) {
  const t = useTranslations("studio");

  return (
    <fieldset className="space-y-4 rounded-2xl border border-[--border-subtle] bg-[--surface]/50 p-4">
      <legend className="px-1 text-sm font-semibold text-[--text-primary]">
        {t("freeOptions")}
      </legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-xs font-medium text-[--text-secondary]">
          <span>{t("freeRatio")}</span>
          <select
            value={ratio}
            className={SELECT_CLASS_NAME}
            onChange={(event) =>
              onRatioChange(event.target.value as FreeCreationRatio)
            }
          >
            {FREE_CREATION_RATIOS.map((ratioValue) => (
              <option key={ratioValue} value={ratioValue}>
                {ratioValue === "adaptive" ? t("freeAdaptive") : ratioValue}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-[--text-secondary]">
          <span>{t("freeResolution")}</span>
          <select
            value={resolution}
            className={SELECT_CLASS_NAME}
            onChange={(event) =>
              onResolutionChange(event.target.value as FreeCreationResolution)
            }
          >
            {FREE_CREATION_RESOLUTIONS.map((resolutionValue) => (
              <option
                key={resolutionValue}
                value={resolutionValue}
                disabled={resolutionValue === "1080p" && !supports1080p}
              >
                {resolutionValue}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-[--text-secondary]">
          <span>{t("freeSeed")}</span>
          <input
            type="number"
            min={-1}
            max={4_294_967_295}
            value={seed}
            placeholder={t("freeRandom")}
            className={SELECT_CLASS_NAME}
            onChange={(event) => onSeedChange(event.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-2 text-xs font-medium text-[--text-secondary]">
        <span className="flex items-center justify-between">
          <span>{t("freeDuration")}</span>
          <output className="font-semibold tabular-nums text-[--text-primary]">
            {duration}s
          </output>
        </span>
        <input
          type="range"
          min={FREE_CREATION_DURATION_MIN_SECONDS}
          max={Math.min(FREE_CREATION_DURATION_MAX_SECONDS, maxDuration)}
          step={1}
          value={duration}
          className="w-full accent-primary"
          onChange={(event) => onDurationChange(Number(event.target.value))}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-xl border border-[--border-subtle] bg-white p-3 text-sm text-[--text-secondary]">
          <input
            type="checkbox"
            checked={generateAudio}
            className="mt-0.5 h-4 w-4 accent-primary"
            onChange={(event) => onGenerateAudioChange(event.target.checked)}
          />
          <span>
            <span className="block font-semibold text-[--text-primary]">
              {t("freeGenerateAudio")}
            </span>
            <span className="mt-0.5 block text-xs text-[--text-muted]">
              {t("freeGenerateAudioHint")}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[--border-subtle] bg-white p-3 text-sm text-[--text-secondary]">
          <input
            type="checkbox"
            checked={watermark}
            className="mt-0.5 h-4 w-4 accent-primary"
            onChange={(event) => onWatermarkChange(event.target.checked)}
          />
          <span>
            <span className="block font-semibold text-[--text-primary]">
              {t("freeWatermark")}
            </span>
            <span className="mt-0.5 block text-xs text-[--text-muted]">
              {t("freeWatermarkHint")}
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
