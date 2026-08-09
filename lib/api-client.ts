export class ApiError extends Error {
  details?: Record<string, string[]>;
  constructor(message: string, details?: Record<string, string[]>) {
    super(message);
    this.details = details;
  }
}

export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });

  if (!res.ok) {
    let errorBody;
    try {
      errorBody = await res.json();
    } catch {
      // Response is not JSON (e.g. HTML error page)
      throw new ApiError(`Request failed with status ${res.status}`);
    }
    throw new ApiError(errorBody?.error?.message ?? 'Request failed', errorBody?.error?.details);
  }

  const body = await res.json();
  return body.data as T;
}

export const apiClient = {
  get: <T>(url: string) => apiFetch<T>(url, { method: 'GET' }),
  post: <T>(url: string, body: any) => apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: any) => apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: 'DELETE' }),
  fetch: <T>(url: string, options?: any) => apiFetch<T>(url, options),
};
