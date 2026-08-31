"use client";

import { useTranslations } from "next-intl";
import { Download, Loader2, XCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FREE_CREATION_STATUS,
  type FreeCreationSummary,
} from "@/lib/free-creation";

interface FreeCreationResultProps {
  creation: FreeCreationSummary;
  onCancel: (creation: FreeCreationSummary) => Promise<void>;
}

export function FreeCreationResult({ creation, onCancel }: FreeCreationResultProps) {
  const t = useTranslations("studio");
  const isActive =
    creation.status === FREE_CREATION_STATUS.PENDING ||
    creation.status === FREE_CREATION_STATUS.RUNNING;
  const errorMessage = creation.errorCode
    ? t(`freeError_${creation.errorCode}`)
    : creation.error;

  if (!creation.videoUrl) {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-[--border-subtle] bg-white p-5 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {isActive ? (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[--text-muted]" />
            )}
            <div>
              <h3 className="font-display text-lg font-semibold text-[--text-primary]">
                {isActive ? t("freeGenerationInProgress") : t(`freeStatus_${creation.status}`)}
              </h3>
              <p className="mt-1 text-sm text-[--text-secondary]">
                {errorMessage ?? (creation.prompt || t("freeImageOnlyCreation"))}
              </p>
              {isActive ? (
                <p className="mt-2 text-xs tabular-nums text-[--text-muted]">
                  {t("freeProgress", { progress: creation.progress })}
                </p>
              ) : null}
            </div>
          </div>
          {isActive ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void onCancel(creation)}>
              {t("freeCancel")}
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="free-result-title"
      className="rounded-3xl border border-[--border-subtle] bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3
            id="free-result-title"
            className="font-display text-lg font-semibold text-[--text-primary]"
          >
            {t("freeResult")}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-[--text-muted]">
            {creation.prompt || t("freeImageOnlyCreation")}
          </p>
        </div>
        <a
          href={creation.videoUrl}
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download className="h-3.5 w-3.5" />
          {t("freeDownload")}
        </a>
      </div>
      <video
        key={creation.videoUrl}
        src={creation.videoUrl}
        controls
        preload="metadata"
        className="aspect-video w-full rounded-2xl bg-black object-contain"
      >
        {t("freeVideoUnsupported")}
      </video>
    </section>
  );
}
