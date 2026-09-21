import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(path: string, cookie?: string, session?: string) {
  const headers = new Headers();
  const parts = [cookie ? `mshwar-locale=${cookie}` : null, session ? `mshwar_session=${session}` : null].filter(
    Boolean,
  );
  if (parts.length > 0) {
    headers.set("cookie", parts.join("; "));
  }
  return new NextRequest(new URL(path, "http://127.0.0.1:3001"), { headers });
}

function rewriteTarget(response: Response) {
  return response.headers.get("x-middleware-rewrite") ?? "";
}

function location(response: Response) {
  return response.headers.get("location") ?? "";
}

describe("locale proxy", () => {
  it("rewrites a prefixed Arabic path and stores the guest cookie", () => {
    const response = proxy(request("/ar/destinations"));
    expect(rewriteTarget(response)).toContain("/destinations");
    expect(response.cookies.get("mshwar-locale")?.value).toBe("ar");
  });

  it("keeps an unprefixed path on the cookie locale so guests persist without a prefix", () => {
    const response = proxy(request("/destinations", "ar"));
    expect(rewriteTarget(response)).toBe("");
    expect(response.cookies.get("mshwar-locale")?.value).toBe("ar");
  });

  it("sends unauthenticated locale-prefixed plan visits to locale-prefixed sign-in", () => {
    const response = proxy(request("/ar/plan"));
    expect(location(response)).toContain("/ar/signin");
    expect(location(response)).toContain("next=%2Far%2Fplan");
  });

  it("lets a signed-in visitor through a protected prefixed path", () => {
    const response = proxy(request("/fr/settings", "fr", "session-token"));
    expect(location(response)).toBe("");
    expect(rewriteTarget(response)).toContain("/settings");
    expect(response.cookies.get("mshwar-locale")?.value).toBe("fr");
  });

  it("stamps a fresh request id on pages and API calls, ignoring the browser's", () => {
    const page = proxy(request("/destinations"));
    const pageId = page.headers.get("x-request-id") ?? "";
    expect(pageId).toMatch(/^[0-9a-f]{32}$/);
    expect(page.headers.get("x-middleware-request-x-request-id")).toBe(pageId);

    const forged = new NextRequest(new URL("/api/v1/trips", "http://127.0.0.1:3001"), {
      headers: { "x-request-id": "chosen-by-attacker" },
    });
    const api = proxy(forged);
    const apiId = api.headers.get("x-request-id") ?? "";
    expect(apiId).toMatch(/^[0-9a-f]{32}$/);
    expect(api.headers.get("x-middleware-request-x-request-id")).toBe(apiId);
    expect(api.headers.get("location")).toBeNull();
    expect(api.cookies.get("mshwar-locale")).toBeUndefined();
  });
});
