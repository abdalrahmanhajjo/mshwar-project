import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatNumber, formatPlural } from "./format";

describe("locale-aware formatting", () => {
  it("formats currency, numbers and dates per locale", () => {
    expect(formatCurrency("en", 35, "USD")).toMatch(/\$35\.00/);
    expect(formatCurrency("fr", 35, "USD")).toMatch(/35/);
    expect(formatNumber("ar", 1200)).toMatch(/1[,.]?200|١/);
    const date = formatDate("en", "2026-09-14T00:00:00Z", { timeZone: "UTC", dateStyle: "medium" });
    expect(date).toMatch(/2026|Sep/);
  });

  it("selects plural forms with the locale plural rules", () => {
    expect(formatPlural("en", 1, { one: "{count} stop", other: "{count} stops" })).toBe("1 stop");
    expect(formatPlural("en", 3, { one: "{count} stop", other: "{count} stops" })).toBe("3 stops");
    expect(formatPlural("ar", 1, { one: "محطة واحدة", other: "{count} محطات" })).toBe("محطة واحدة");
    expect(formatPlural("ar", 3, { one: "محطة واحدة", other: "{count} محطات", few: "{count} محطات" })).toMatch(/محطات/);
  });
});
