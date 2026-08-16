export function normalizeOverallStyle(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function buildOverallStyleContext(value: string | null | undefined): string {
  const overallStyle = normalizeOverallStyle(value);
  if (!overallStyle) return "";

  return [
    "【整体视觉风格（最高优先级）】",
    overallStyle,
    "",
    "所有剧本、角色、分镜、场景参考图、首尾帧和视频提示词都必须遵循此整体风格。",
    "除非用户在当前请求中明确要求真人、实拍或写实摄影，否则不要把画面默认转成真人摄影风格。",
  ].join("\n");
}

export function mergeOverallStyleWithVisualStyle(
  overallStyle: string | null | undefined,
  visualStyle: string
): string {
  const normalizedOverallStyle = normalizeOverallStyle(overallStyle);
  if (!normalizedOverallStyle) return visualStyle;
  if (!visualStyle) return normalizedOverallStyle;

  return `整体风格：${normalizedOverallStyle}；剧本解析风格：${visualStyle}`;
}
