type FetchMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface ApiOptions {
  method?: FetchMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const config: RequestInit = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, config);

  if (response.status === 401) {
    window.location.href = "/login";
    throw new ApiError("Unauthorized", 401);
  }

  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || "Access denied", 403, data);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || "Request failed", response.status, data);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const secureApi = {
  get: <T = unknown>(endpoint: string) => api<T>(endpoint, { method: "GET" }),
  post: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: "POST", body }),
  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: "PATCH", body }),
  put: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: "PUT", body }),
  delete: <T = unknown>(endpoint: string) =>
    api<T>(endpoint, { method: "DELETE" }),
};

export { api, ApiError };
