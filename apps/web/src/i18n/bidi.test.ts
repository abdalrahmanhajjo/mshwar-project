import { describe, expect, it } from "vitest";
import { detectRunDirection, hasMixedDirection, isolateBidi, isolateLatinRuns } from "./bidi";

describe("bidi isolation", () => {
  it("detects mixed Arabic and Latin and isolates Latin runs", () => {
    const mixed = "خطة يوم في Byblos";
    expect(hasMixedDirection(mixed)).toBe(true);
    expect(detectRunDirection("جبيل")).toBe("rtl");
    expect(detectRunDirection("Byblos")).toBe("ltr");
    expect(isolateBidi("Byblos", "ltr")).toContain("Byblos");
    expect(isolateLatinRuns(mixed)).toContain("\u2066Byblos\u2069");
  });
});
