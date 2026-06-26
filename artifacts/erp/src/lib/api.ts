import { getAuthToken } from "@/lib/auth-token";

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `HTTP ${response.status}`;
    try {
      const data = JSON.parse(text) as { error?: unknown; message?: unknown };
      const raw = data.error ?? data.message;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw) as Array<{ message?: string }>;
          message = parsed[0]?.message ?? raw;
        } catch {
          message = raw;
        }
      }
    } catch {
      message = text || `HTTP ${response.status}`;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
