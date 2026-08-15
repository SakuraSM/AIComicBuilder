"use client";

import { useEffect, useState } from "react";
import { Calculator, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";

export interface PreflightStage {
  type:
    | "script_outline"
    | "script_parse"
    | "character_extract"
    | "character_image"
    | "shot_split"
    | "frame_generate"
    | "video_generate"
    | "video_assemble";
  stage: string;
  payload?: Record<string, unknown>;
  modelProfileId?: string;
}

interface CostEstimate {
  currency: string;
  isAvailable: boolean;
  amount: string | null;
  shotCount: number;
}

interface GenerationPreflightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  episodeId?: string;
  mode: "guided" | "professional";
  stages: PreflightStage[];
  onRunStarted: () => void;
}

export function GenerationPreflightDialog({
  open,
  onOpenChange,
  projectId,
  episodeId,
  mode,
  stages,
  onRunStarted,
}: GenerationPreflightDialogProps) {
  const t = useTranslations("studio");
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const abortController = new AbortController();
    async function loadEstimate(): Promise<void> {
      setIsEstimating(true);
      try {
        const response = await apiFetch(`/api/projects/${projectId}/runs/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId,
            stages: Array.from(new Set(stages.map((stage) => stage.stage))),
          }),
          signal: abortController.signal,
        });
        setEstimate((await response.json()) as CostEstimate);
      } catch (error) {
        if (!abortController.signal.aborted) {
          toast.error(error instanceof Error ? error.message : t("estimateFailed"));
        }
      } finally {
        if (!abortController.signal.aborted) setIsEstimating(false);
      }
    }
    void loadEstimate();
    return () => abortController.abort();
  }, [episodeId, open, projectId, stages, t]);

  async function handleStartRun(): Promise<void> {
    setIsStarting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId,
          mode,
          estimatedCost: estimate?.amount,
          stages,
        }),
      });
      toast.success(t("runStarted"));
      onOpenChange(false);
      onRunStarted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("runStartFailed"));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("preflightTitle")}</DialogTitle>
          <DialogDescription>{t("preflightDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[--surface] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[--text-muted]">
                {t("queuedTasks")}
              </p>
              <p className="mt-1 font-display text-xl font-semibold text-[--text-primary]">
                {stages.length}
              </p>
            </div>
            <div className="rounded-xl bg-[--surface] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[--text-muted]">
                {t("cost")}
              </p>
              <p className="mt-1 font-display text-xl font-semibold text-[--text-primary]">
                {isEstimating ? "…" : estimate?.isAvailable ? `${estimate.amount} ${estimate.currency}` : t("notConfigured")}
              </p>
            </div>
          </div>

          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[--border-subtle] p-3">
            {Array.from(new Set(stages.map((stage) => stage.stage))).map((stage) => (
              <li key={stage} className="flex items-center gap-2 text-sm text-[--text-secondary]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="capitalize">{stage.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{t("preflightRecoveryHint")}</span>
          </div>
          {!estimate?.isAvailable && !isEstimating && (
            <div className="flex items-start gap-2 text-xs text-[--text-muted]">
              <Calculator className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{t("costConfigurationHint")}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("back")}
          </Button>
          <Button type="button" onClick={handleStartRun} disabled={isStarting || stages.length === 0}>
            {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("startRun")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
