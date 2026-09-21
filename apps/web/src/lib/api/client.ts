/**
 * The one way browser code talks to the Mshwar API (same-origin, cookie session).
 * Every module used to carry its own copy of this with slightly different error handling.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** Stable machine code from the API ("unauthenticated", "forbidden", "rate_limited", "ai_quota_exceeded", ...). */
  readonly code: string | null;
  /** Correlation id to quote to support; matches the API and Sentry. */
  readonly requestId: string | null;
  /** Seconds to wait before retrying, when the API sent Retry-After. */
  readonly retryAfter: number | null;

  constructor(
    message: string,
    status: number,
    body: unknown,
    meta: { requestId?: string | null; retryAfter?: number | null } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    this.code = typeof record.code === "string" ? record.code : null;
    this.requestId = (typeof record.request_id === "string" ? record.request_id : null) ?? meta.requestId ?? null;
    this.retryAfter = meta.retryAfter ?? null;
  }
}

export type ApiRequestInit = RequestInit & {
  /** Message used when the response carries no readable `detail`. Defaults to the HTTP status text. */
  fallbackMessage?: string;
};

/** FastAPI returns `detail` as a string, or as a list of validation issues. */
export function errorDetail(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    if (first && typeof first === "object" && typeof (first as { msg?: unknown }).msg === "string") {
      return (first as { msg: string }).msg;
    }
  }
  return null;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { fallbackMessage, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  if (requestInit.body && !headers.has("Content-Type") && !(requestInit.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...requestInit, credentials: "include", headers });
  if (!response.ok) {
    const body = await readBody(response);
    const message = errorDetail(body) ?? fallbackMessage ?? (response.statusText || "request-failed");
    const retryAfter = Number(response.headers?.get("retry-after"));
    throw new ApiError(message, response.status, body, {
      requestId: response.headers?.get("x-request-id") ?? null,
      retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    });
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers?.get("content-type") ?? "";
  if (contentType.includes("text/csv")) {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}
