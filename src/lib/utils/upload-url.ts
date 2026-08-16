import { objectUrlToPublicUrl } from "@/lib/storage/url";

export function uploadUrl(filePath: string): string {
  return objectUrlToPublicUrl(filePath.replace(/\\/g, "/"));
}
