/**
 * HTTP client for the Yuna server API.
 * Thin wrapper that adds auth headers and handles errors consistently.
 */

export interface ApiOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  token?: string;
  timeout?: number;
}

export async function apiCall<T = unknown>(
  serverUrl: string,
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, token, timeout = 60_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${serverUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err =
        (data && typeof data === "object" && "error" in data
          ? (data as { error: string }).error
          : null) || `HTTP ${res.status}`;
      throw new Error(err);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}
