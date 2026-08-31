import type { FormEvent } from "react";
import type {
  FreeCreationMode,
  FreeCreationRatio,
  FreeCreationResolution,
  FreeCreationSummary,
} from "@/lib/free-creation";

export interface UseFreeCreationResult {
  mode: FreeCreationMode;
  selectMode: (mode: FreeCreationMode) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  firstFrameFiles: File[];
  setFirstFrameFiles: (files: File[]) => void;
  lastFrameFiles: File[];
  setLastFrameFiles: (files: File[]) => void;
  referenceFiles: File[];
  setReferenceFiles: (files: File[]) => void;
  duration: number;
  setDuration: (duration: number) => void;
  ratio: FreeCreationRatio;
  setRatio: (ratio: FreeCreationRatio) => void;
  resolution: FreeCreationResolution;
  setResolution: (resolution: FreeCreationResolution) => void;
  generateAudio: boolean;
  setGenerateAudio: (generateAudio: boolean) => void;
  watermark: boolean;
  setWatermark: (watermark: boolean) => void;
  seed: string;
  setSeed: (seed: string) => void;
  isGenerating: boolean;
  error: string | null;
  creations: FreeCreationSummary[];
  selectedCreation: FreeCreationSummary | null;
  setSelectedCreation: (creation: FreeCreationSummary) => void;
  modelProfileId?: string;
  isOfficialSeedance: boolean;
  maxDuration: number;
  supports1080p: boolean;
  maxReferenceImages: number;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCancel: (creation: FreeCreationSummary) => Promise<void>;
}
