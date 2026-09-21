import { describe, expect, it } from "vitest";
import { bookingModeCopy, checkoutCopy } from "./checkout-copy";

describe("checkout copy", () => {
  it("keeps the same keys in en, ar and fr", () => {
    const keys = Object.keys(checkoutCopy.en);
    expect(Object.keys(checkoutCopy.ar)).toEqual(keys);
    expect(Object.keys(checkoutCopy.fr)).toEqual(keys);
    expect(bookingModeCopy("instant", "en")).toBe("Instant confirm");
    expect(bookingModeCopy("inquiry", "ar")).toBe("استفسار فقط");
  });
});
