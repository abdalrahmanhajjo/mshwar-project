import { describe, expect, it } from "vitest";
import { isProtectedPath, isAdminUser, safeNextPath } from "./auth";

describe("auth helpers", () => {
  it("marks the traveller account routes as protected", () => {
    expect(isProtectedPath("/plan")).toBe(true);
    expect(isProtectedPath("/saved/list")).toBe(true);
    expect(isProtectedPath("/trips")).toBe(true);
    expect(isProtectedPath("/favorites")).toBe(true);
    expect(isProtectedPath("/ar/favorites")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isAdminUser({ id: "1", email: "a@b.c", display_name: "A", locale: "en", admin_tier: "elevated" })).toBe(
      true,
    );
    expect(isProtectedPath("/")).toBe(false);
    // Phase 2 surfaces are not routes in this milestone, so they are not gated.
    expect(isProtectedPath("/business/listings")).toBe(false);
    expect(isProtectedPath("/admin/users")).toBe(false);
    expect(isProtectedPath("/unsubscribe/token")).toBe(false);
    expect(isProtectedPath("/signin")).toBe(false);
    expect(isProtectedPath("/forgot-password")).toBe(false);
    expect(isProtectedPath("/reset-password")).toBe(false);
    expect(isProtectedPath("/verify-email")).toBe(false);
    expect(isProtectedPath("/privacy")).toBe(false);
    expect(isProtectedPath("/join/abc")).toBe(false);
    expect(isProtectedPath("/ar/plan")).toBe(true);
    expect(isProtectedPath("/fr/settings")).toBe(true);
    expect(isProtectedPath("/ar")).toBe(false);
  });

  it("rejects open redirects in the next param", () => {
    expect(safeNextPath("/saved")).toBe("/saved");
    expect(safeNextPath("/plan?x=1")).toBe("/plan?x=1");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("safeNextPath", () => {
  it.each(["//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "https://evil.example", ""])(
    "rejects %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );

  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/ar/plan?stop=2#map")).toBe("/ar/plan?stop=2#map");
  });
});
