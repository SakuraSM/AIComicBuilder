export interface TextOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  images?: string[];  // local file paths for vision input
}

export interface ImageOptions {
  model?: string;
  size?: string;
  aspectRatio?: string;
  quality?: string;
  referenceImages?: string[];
  /** Labels for reference images, e.g. character names. Must match referenceImages order. */
  referenceLabels?: string[];
}

export interface AIProvider {
  generateText(prompt: string, options?: TextOptions): Promise<string>;
  generateImage(prompt: string, options?: ImageOptions): Promise<string>;
}

// Text mode: prompt only, without an image anchor.
type TextVideoParams = {
  firstFrame?: never;
  lastFrame?: never;
  initialImage?: never;
  referenceImages?: never;
};

// First-frame mode: animate from one image without forcing an end frame.
type FirstFrameVideoParams = {
  firstFrame: string;
  lastFrame?: never;
  initialImage?: never;
  referenceImages?: never;
};

// Keyframe mode: both firstFrame and lastFrame must be provided.
type KeyframeVideoParams = {
  firstFrame: string;
  lastFrame: string;
  initialImage?: never;
  referenceImages?: never;
};

// Reference image mode: one or more images used as visual references.
type ReferenceVideoParams = {
  firstFrame?: never;
  lastFrame?: never;
  initialImage: string;
  referenceImages?: string[];
};

export type VideoGenerateParams = (
  | TextVideoParams
  | FirstFrameVideoParams
  | KeyframeVideoParams
  | ReferenceVideoParams
) & {
  prompt: string;
  duration: number;
  ratio: string;
  resolution?: "480p" | "720p" | "1080p";
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
  returnLastFrame?: boolean;
};

export interface VideoGenerateResult {
  filePath: string;
  lastFrameUrl?: string;
}

export interface VideoGenerateContext {
  signal?: AbortSignal;
}

export interface VideoProvider {
  generateVideo(
    params: VideoGenerateParams,
    context?: VideoGenerateContext,
  ): Promise<VideoGenerateResult>;
}
