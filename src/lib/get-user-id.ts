import { getUserIdFromSignedRequest } from "@/lib/auth/session";

export function getUserIdFromRequest(request: Request): string {
  return getUserIdFromSignedRequest(request);
}
