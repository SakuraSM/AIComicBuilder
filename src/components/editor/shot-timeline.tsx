"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Clock3,
  ImageIcon,
  Lock,
  LockOpen,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";
import { uploadUrl } from "@/lib/utils/upload-url";
import { getFirstFrameUrl, type Shot } from "@/stores/project-store";
import { cn } from "@/lib/utils";

const PIXELS_PER_SECOND = 12;
const MINIMUM_SHOT_WIDTH_PX = 144;
const SHOT_SEQUENCE_DIGITS = 2;

interface ShotTimelineProps {
  projectId: string;
  shots: Shot[];
  onOpenShot: (shotId: string) => void;
  onRefresh: () => Promise<void>;
}

interface TimelineShotProps {
  projectId: string;
  shot: Shot;
  onOpenShot: (shotId: string) => void;
  onRefresh: () => Promise<void>;
}

function TimelineShot({
  projectId,
  shot,
  onOpenShot,
  onRefresh,
}: TimelineShotProps) {
  const t = useTranslations("studio");
  const [isUpdating, setIsUpdating] = useState(false);
  const frameUrl = getFirstFrameUrl(shot);
  const width = Math.max(MINIMUM_SHOT_WIDTH_PX, shot.duration * PIXELS_PER_SECOND);

  async function updateReview(input: {
    isLocked?: number;
    qualityStatus?: "pending" | "approved" | "rejected";
  }): Promise<void> {
    setIsUpdating(true);
    try {
      await apiFetch(`/api/projects/${projectId}/shots/${shot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("reviewUpdateFailed"));
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenShot(): void {
    onOpenShot(shot.id);
  }

  function handleToggleLock(): void {
    void updateReview({ isLocked: shot.isLocked ? 0 : 1 });
  }

  function handleApprove(): void {
    void updateReview({ qualityStatus: "approved" });
  }

  function handleReject(): void {
    void updateReview({ qualityStatus: "rejected" });
  }

  return (
    <article
      className={cn(
        "relative flex-shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm",
        shot.qualityStatus === "approved" && "border-emerald-300",
        shot.qualityStatus === "rejected" && "border-red-300",
        (!shot.qualityStatus || shot.qualityStatus === "pending") &&
          "border-[--border-subtle]",
      )}
      style={{ width }}
    >
      <button
        type="button"
        onClick={handleOpenShot}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
      >
        <div className="relative aspect-video bg-[--surface]">
          {frameUrl ? (
            <Image
              src={uploadUrl(frameUrl)}
              alt={t("shotFrameAlt", { sequence: shot.sequence })}
              fill
              sizes={`${Math.round(width)}px`}
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="h-5 w-5 text-[--text-muted]" />
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {String(shot.sequence).padStart(SHOT_SEQUENCE_DIGITS, "0")}
          </span>
        </div>
        <div className="p-2.5">
          <p className="line-clamp-2 min-h-8 text-xs text-[--text-primary]">
            {shot.prompt || t("untitledShot")}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[--text-muted]">
            <Clock3 className="h-3 w-3" />
            {shot.duration}s
          </p>
        </div>
      </button>
      <div className="flex items-center justify-between border-t border-[--border-subtle] px-2 py-1.5">
        <button
          type="button"
          onClick={handleToggleLock}
          disabled={isUpdating}
          aria-label={shot.isLocked ? t("unlockShot") : t("lockShot")}
          aria-pressed={Boolean(shot.isLocked)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[--text-muted] outline-none hover:bg-[--surface] hover:text-[--text-primary] focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
        >
          {shot.isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReject}
            disabled={isUpdating}
            aria-label={t("rejectShot")}
            aria-pressed={shot.qualityStatus === "rejected"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40",
              shot.qualityStatus === "rejected"
                ? "bg-red-50 text-red-700"
                : "text-[--text-muted] hover:bg-red-50 hover:text-red-700",
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isUpdating}
            aria-label={t("approveShot")}
            aria-pressed={shot.qualityStatus === "approved"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-40",
              shot.qualityStatus === "approved"
                ? "bg-emerald-50 text-emerald-700"
                : "text-[--text-muted] hover:bg-emerald-50 hover:text-emerald-700",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ShotTimeline({
  projectId,
  shots,
  onOpenShot,
  onRefresh,
}: ShotTimelineProps) {
  const t = useTranslations("studio");
  const totalDuration = shots.reduce((duration, shot) => duration + shot.duration, 0);
  const approvedCount = shots.filter(
    (shot) => shot.qualityStatus === "approved",
  ).length;

  return (
    <section aria-labelledby="shot-timeline-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[--border-subtle] bg-white px-4 py-3">
        <div>
          <h3 id="shot-timeline-title" className="text-sm font-semibold text-[--text-primary]">
            {t("timeline")}
          </h3>
          <p className="mt-0.5 text-xs text-[--text-muted]">
            {t("timelineSummary", {
              count: shots.length,
              duration: totalDuration,
              approved: approvedCount,
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[--text-muted]">
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" />{t("locked")}</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />{t("approved")}</span>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-600" />{t("needsWork")}</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[--border-subtle] bg-[--surface]/60 p-4">
        <div className="flex min-w-max items-start gap-2">
          {shots.map((shot) => (
            <TimelineShot
              key={shot.id}
              projectId={projectId}
              shot={shot}
              onOpenShot={onOpenShot}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
