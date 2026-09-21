import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contrastRatio, relativeLuminance, roundContrast } from "./contrast.mjs";
import { auditContrast, expandCatalog, loadContrastCatalog } from "./assert-contrast.mjs";
import { loadTokens } from "./generate-tokens.mjs";

const tokens = loadTokens();
const catalog = loadContrastCatalog();

describe("WCAG relative luminance", () => {
  it("recomputes known brand-review pairings", () => {
    assert.equal(roundContrast(contrastRatio("#12352F", "#FCFCF8")), 12.96);
    assert.equal(roundContrast(contrastRatio("#FFFFFF", "#F3653E")), 3.11);
    assert.equal(roundContrast(contrastRatio("#12352F", "#F3653E")), 4.28);
    assert.equal(roundContrast(contrastRatio("#0C241F", "#F3653E")), 5.24);
    assert.ok(relativeLuminance("#FFFFFF") > relativeLuminance("#12352F"));
  });
});

describe("token contrast assertion", () => {
  it("expands every in-use pairing for light and dark", () => {
    const pairings = expandCatalog(catalog);
    const required = pairings.filter((item) => item.allowed !== false);
    assert.ok(required.some((item) => item.id.includes("light-text-muted-on-surface-sunken")));
    assert.ok(required.some((item) => item.id.includes("dark-text-muted-on-surface-sunken")));
    assert.ok(required.some((item) => item.usage === "non-text" && item.id.includes("border-default")));
    assert.ok(required.some((item) => item.id.includes("focus-ring")));
    assert.ok(pairings.some((item) => item.allowed === false && item.id === "white-on-accent"));
  });

  it("passes WCAG AA for every required pairing in the token file", () => {
    const audit = auditContrast(tokens, catalog);
    assert.deepEqual(
      audit.failures.map((item) => `${item.id} ${item.ratio}<${item.minRatio}`),
      [],
    );
  });

  it("fails when muted text regresses below 4.5:1 on sunken surfaces", () => {
    const regressing = structuredClone(tokens);
    regressing.primitive.color.slate = "#66756E";
    const audit = auditContrast(regressing, catalog);
    assert.ok(
      audit.failures.some((item) => item.id === "light-text-muted-on-surface-sunken"),
      "expected the brand-review muted/sunken pairing to fail on the old slate",
    );
  });

  it("fails when the default border regresses below 3:1", () => {
    const regressing = structuredClone(tokens);
    regressing.primitive.color.border = "#D8E0DC";
    const audit = auditContrast(regressing, catalog);
    assert.ok(audit.failures.some((item) => item.id.startsWith("light-border-default-on-surface")));
  });
});
