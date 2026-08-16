"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleStop,
  Clock3,
  ListChecks,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useGenerationRuns,
  type GenerationRunListItem,
} from "@/hooks/use-generation-runs";
import { cn } from "@/lib/utils";

interface TaskCenterProps {
  projectId: string;
}

const RUN_STATUS_ICON = {
  pending: Clock3,
  running: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: CircleStop,
};

const RUN_STATUS_CLASS = {
  pending: "text-amber-700 bg-amber-50",
  running: "text-blue-700 bg-blue-50",
  completed: "text-emerald-700 bg-emerald-50",
  failed: "text-red-700 bg-red-50",
  cancelled: "text-[--text-muted] bg-[--surface]",
};

const TRANSLATED_RUN_STAGES = new Set([
  "preflight",
  "script",
  "characters",
  "storyboard",
  "frames",
  "video_prompts",
  "videos",
  "assembly",
  "generation",
]);

interface RunCardProps {
  run: GenerationRunListItem;
  onCancel: (runId: string) => Promise<void>;
  onRetry: (runId: string) => Promise<void>;
}

function RunCard({ run, onCancel, onRetry }: RunCardProps) {
  const t = useTranslations("studio");
  const StatusIcon = RUN_STATUS_ICON[run.status];
  const isActive = run.status === "pending" || run.status === "running";
  const isFailed = run.status === "failed";
  const stageLabel = TRANSLATED_RUN_STAGES.has(run.currentStage)
    ? t(`stages.${run.currentStage}`)
    : run.currentStage.replaceAll("_", " ");

  async function handleCancel(): Promise<void> {
    try {
      await onCancel(run.id);
      toast.success(t("runCancelled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("runActionFailed"));
    }
  }

  async function handleRetry(): Promise<void> {
    try {
      await onRetry(run.id);
      toast.success(t("runRetried"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("runActionFailed"));
    }
  }

  return (
    <article className="rounded-xl border border-[--border-subtle] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                RUN_STATUS_CLASS[run.status],
              )}
            >
              <StatusIcon
                className={cn("h-3.5 w-3.5", run.status === "running" && "animate-spin")}
              />
            </span>
            <div>
              <p className="text-sm font-semibold text-[--text-primary]">
                {stageLabel}
              </p>
              <p className="text-[11px] text-[--text-muted]">
                {t(`runStatus.${run.status}`)} · {run.mode === "guided" ? t("guided") : t("professional")}
              </p>
            </div>
          </div>
        </div>
        {isActive && (
          <Button type="button" size="xs" variant="ghost" onClick={handleCancel}>
            <CircleStop className="h-3 w-3" />
            {t("cancelRun")}
          </Button>
        )}
        {isFailed && (
          <Button type="button" size="xs" variant="outline" onClick={handleRetry}>
            <RotateCcw className="h-3 w-3" />
            {t("retryFailed")}
          </Button>
        )}
      </div>
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-[--text-muted]">
          <span>{t("progress")}</span>
          <span className="font-mono tabular-nums">{run.progress}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[--surface]"
          role="progressbar"
          aria-label={t("runProgress")}
          aria-valuenow={run.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${run.progress}%` }}
          />
        </div>
      </div>
      {(run.estimatedCost || run.actualCost) && (
        <p className="mt-2 text-[11px] text-[--text-muted]">
          {run.actualCost
            ? t("actualCost", { cost: run.actualCost })
            : t("estimatedCost", { cost: run.estimatedCost ?? "—" })}
        </p>
      )}
    </article>
  );
}

export function TaskCenter({ projectId }: TaskCenterProps) {
  const t = useTranslations("studio");
  const [isOpen, setIsOpen] = useState(false);
  const { runs, isLoading, error, refreshRuns, cancelRun, retryRun } =
    useGenerationRuns(projectId);
  const activeRunCount = runs.filter(
    (run) => run.status === "pending" || run.status === "running",
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("taskCenter")}
            className="relative"
          />
        }
      >
        <ListChecks className="h-4 w-4" />
        {activeRunCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
            {activeRunCount}
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="left-auto right-0 top-0 h-dvh max-w-full translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none border-y-0 border-r-0 p-5 sm:max-w-md">
        <DialogHeader className="pr-10">
          <DialogTitle>{t("taskCenter")}</DialogTitle>
          <DialogDescription>{t("taskCenterDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-b border-[--border-subtle] pb-3">
          <p className="text-xs font-medium text-[--text-muted]">
            {t("runCount", { count: runs.length })}
          </p>
          <Button type="button" variant="ghost" size="xs" onClick={refreshRuns}>
            <RefreshCw className="h-3 w-3" />
            {t("refresh")}
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[--text-muted]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingRuns")}
          </div>
        )}
        {!isLoading && error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {!isLoading && !error && runs.length === 0 && (
          <div className="rounded-xl border border-dashed border-[--border-subtle] bg-[--surface]/50 px-6 py-12 text-center">
            <ListChecks className="mx-auto h-6 w-6 text-[--text-muted]" />
            <p className="mt-3 text-sm font-medium text-[--text-primary]">
              {t("noRuns")}
            </p>
            <p className="mt-1 text-xs text-[--text-muted]">{t("noRunsHint")}</p>
          </div>
        )}
        <div className="space-y-3">
          {runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onCancel={cancelRun}
              onRetry={retryRun}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
