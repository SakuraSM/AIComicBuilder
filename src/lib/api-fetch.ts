export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.clone().json();
      if (body.error) message = body.error;
    } catch {}
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/${document.documentElement.lang || "zh"}/login`);
    }
    throw new ApiError(response.status, message);
  }
  return response;
}
