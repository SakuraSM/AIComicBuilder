"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

const RUN_REFRESH_INTERVAL_MS = 4_000;

export interface GenerationRunListItem {
  id: string;
  projectId: string;
  episodeId: string | null;
  mode: "guided" | "professional";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  currentStage: string;
  progress: number;
  estimatedCost: string | null;
  actualCost: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UseGenerationRunsResult {
  runs: GenerationRunListItem[];
  isLoading: boolean;
  error: string | null;
  refreshRuns: () => Promise<void>;
  cancelRun: (runId: string) => Promise<void>;
  retryRun: (runId: string) => Promise<void>;
}

export function useGenerationRuns(projectId: string): UseGenerationRunsResult {
  const [runs, setRuns] = useState<GenerationRunListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRuns = useCallback(async (): Promise<void> => {
    try {
      const response = await apiFetch(`/api/projects/${projectId}/runs`);
      const nextRuns = (await response.json()) as GenerationRunListItem[];
      setRuns(nextRuns);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load runs",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refreshRuns();
    const refreshInterval = window.setInterval(
      () => void refreshRuns(),
      RUN_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(refreshInterval);
  }, [refreshRuns]);

  const cancelRun = useCallback(
    async (runId: string): Promise<void> => {
      await apiFetch(`/api/runs/${runId}`, { method: "DELETE" });
      await refreshRuns();
    },
    [refreshRuns],
  );

  const retryRun = useCallback(
    async (runId: string): Promise<void> => {
      await apiFetch(`/api/runs/${runId}/retry`, { method: "POST" });
      await refreshRuns();
    },
    [refreshRuns],
  );

  return { runs, isLoading, error, refreshRuns, cancelRun, retryRun };
}
