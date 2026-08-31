"use client";

import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, Clock3, Loader2, PlayCircle, XCircle } from "lucide-react";
import {
  FREE_CREATION_STATUS,
  type FreeCreationSummary,
} from "@/lib/free-creation";
import { cn } from "@/lib/utils";

interface FreeCreationHistoryProps {
  creations: FreeCreationSummary[];
  selectedId: string | null;
  onSelect: (creation: FreeCreationSummary) => void;
}

const STATUS_ICON = {
  [FREE_CREATION_STATUS.PENDING]: Clock3,
  [FREE_CREATION_STATUS.RUNNING]: Loader2,
  [FREE_CREATION_STATUS.SUCCEEDED]: CheckCircle2,
  [FREE_CREATION_STATUS.FAILED]: XCircle,
  [FREE_CREATION_STATUS.CANCELLED]: Ban,
};

export function FreeCreationHistory({
  creations,
  selectedId,
  onSelect,
}: FreeCreationHistoryProps) {
  const t = useTranslations("studio");

  return (
    <section aria-labelledby="free-creation-history-title" className="space-y-3">
      <div>
        <h3
          id="free-creation-history-title"
          className="font-display text-lg font-semibold text-[--text-primary]"
        >
          {t("freeHistory")}
        </h3>
        <p className="text-xs text-[--text-muted]">{t("freeHistoryHint")}</p>
      </div>
      {creations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[--border-subtle] p-8 text-center text-sm text-[--text-muted]">
          {t("freeHistoryEmpty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {creations.map((creation) => {
            const StatusIcon = STATUS_ICON[creation.status];
            const isSelected = creation.id === selectedId;
            return (
              <li key={creation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(creation)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30",
                    isSelected
                      ? "border-primary/30 bg-primary/5"
                      : "border-[--border-subtle] bg-white hover:bg-[--surface]",
                  )}
                >
                  {creation.status === FREE_CREATION_STATUS.SUCCEEDED ? (
                    <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <StatusIcon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-[--text-muted]",
                        creation.status === FREE_CREATION_STATUS.RUNNING && "animate-spin",
                      )}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block max-h-10 overflow-hidden text-sm font-medium leading-5 text-[--text-primary]">
                      {creation.prompt || t("freeImageOnlyCreation")}
                    </span>
                    <span className="mt-1 block text-[11px] text-[--text-muted]">
                      {t(`freeStatus_${creation.status}`)} · {creation.modelId} · {new Date(creation.createdAt).toLocaleString()}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
