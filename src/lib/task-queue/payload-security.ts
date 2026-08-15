const SENSITIVE_TASK_KEYS = new Set([
  "apikey",
  "secretkey",
  "credentials",
  "modelconfig",
  "password",
  "token",
]);

const MAX_INSPECTION_DEPTH = 12;

export function containsSensitiveTaskData(
  value: unknown,
  depth = 0,
): boolean {
  if (depth > MAX_INSPECTION_DEPTH || value === null) return false;
  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveTaskData(item, depth + 1));
  }
  if (typeof value !== "object") return false;

  return Object.entries(value).some(([key, childValue]) => {
    const normalizedKey = key.replaceAll(/[_-]/g, "").toLowerCase();
    if (SENSITIVE_TASK_KEYS.has(normalizedKey)) return true;
    return containsSensitiveTaskData(childValue, depth + 1);
  });
}

export function assertPersistableTaskPayload(payload: unknown): void {
  if (containsSensitiveTaskData(payload)) {
    throw new Error(
      "Task payloads cannot contain credentials. Use a server-owned modelProfileId.",
    );
  }
}
