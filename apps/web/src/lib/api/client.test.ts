import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, errorDetail } from "./client";

describe("api client", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads string and validation-list error details", () => {
    expect(errorDetail({ detail: "Booking not found" })).toBe("Booking not found");
    expect(errorDetail({ detail: [{ msg: "Field required", loc: ["body", "x"] }] })).toBe("Field required");
    expect(errorDetail({ detail: [{ loc: [] }] })).toBeNull();
    expect(errorDetail("nope")).toBeNull();
  });

  it("throws ApiError with status and readable message", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ detail: [{ msg: "Too short" }] }), { status: 422 }),
    ) as typeof fetch;
    const failure = apiRequest("/api/v1/x", { method: "POST", body: "{}" });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(apiRequest("/api/v1/x")).rejects.toMatchObject({ status: 422, message: "Too short" });
  });

  it("falls back when the error has no JSON body", async () => {
    globalThis.fetch = vi.fn(async () => new Response("oops", { status: 500 })) as typeof fetch;
    await expect(apiRequest("/api/v1/x", { fallbackMessage: "authError" })).rejects.toMatchObject({
      message: "authError",
    });
  });

  it("sends cookies and JSON headers, and handles 204 and CSV", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(apiRequest("/api/v1/x", { method: "POST", body: "{}" })).resolves.toBeUndefined();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    globalThis.fetch = vi.fn(
      async () => new Response("a,b", { status: 200, headers: { "content-type": "text/csv" } }),
    ) as typeof fetch;
    await expect(apiRequest<string>("/api/v1/x.csv")).resolves.toBe("a,b");
  });

  it("exposes the API error code, request id and retry hint", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "Too many requests.", code: "rate_limited", request_id: "req-1" }), {
          status: 429,
          headers: { "retry-after": "42", "x-request-id": "req-1" },
        }),
    ) as typeof fetch;
    await expect(apiRequest("/api/v1/x")).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      requestId: "req-1",
      retryAfter: 42,
    });
  });
});
