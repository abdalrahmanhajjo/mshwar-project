import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const inventoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../generated/figma-54-screens.json");
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));

describe("figma 54-screen inventory", () => {
  it("records the live Figma file and that CI does not write it", () => {
    assert.equal(
      inventory.liveFigmaFile,
      "https://www.figma.com/design/CTLlkbyldx557zamdshjd5/Mshwar--Complete-UI--Clickable-Prototype",
    );
    assert.equal(inventory.liveFigmaPage, "54 screens");
    assert.equal(inventory.repoWritesFigma, false);
    assert.equal(inventory.structuralGridComplete, true);
    assert.equal(inventory.liveCapturePending, true);
    assert.deepEqual(inventory.acceptanceCriteria, {
      ac1Desktop54: true,
      ac2Mobile20: true,
      ac3JourneyGrid: true,
      ac4Handoffs: true,
      ac5NamingAndPublish: true,
    });
  });

  it("documents exactly 54 desktop slots with unique ids", () => {
    assert.equal(inventory.frames.length, 54);
    assert.equal(inventory.derivedFrom.documentedSlots, 54);
    const ids = new Set(inventory.frames.map((frame) => frame.id));
    assert.equal(ids.size, 54);
    const names = new Set(inventory.frames.map((frame) => frame.layerName));
    assert.equal(names.size, 54);
  });

  it("marks 20 mobile-pass routes and 32 live surfaces", () => {
    const mobile = inventory.frames.filter((frame) => frame.mobile390);
    const live = inventory.frames.filter((frame) => frame.status === "live");
    const padded = inventory.frames.filter((frame) => frame.status === "gap" || frame.status === "state");
    assert.equal(mobile.length, 20);
    assert.equal(inventory.derivedFrom.mobilePass, 20);
    assert.equal(live.length, 32);
    assert.equal(inventory.derivedFrom.liveUniqueFrames, 32);
    assert.equal(padded.length, 22);
    assert.ok(mobile.every((frame) => frame.status === "live"));
  });

  it("defines six journey bands and places every frame on the grid", () => {
    assert.equal(inventory.bands.length, 6);
    const bandById = new Map(inventory.bands.map((band) => [band.id, band]));
    const slotWidth = inventory.grid.slotWidth;
    const counts = Object.fromEntries(inventory.bands.map((band) => [band.id, 0]));

    for (const frame of inventory.frames) {
      const band = bandById.get(frame.band);
      assert.ok(band, `unknown band ${frame.band}`);
      assert.equal(frame.x, frame.slot * slotWidth);
      assert.equal(frame.y, band.y);
      if (frame.mobile390) {
        assert.equal(frame.mobileY, band.y + inventory.grid.mobileOffsetY);
      }
      counts[frame.band] += 1;
    }

    for (const band of inventory.bands) {
      assert.equal(counts[band.id], band.slotCount);
    }
  });

  it("documents four cross-surface handoffs with annotation text", () => {
    assert.equal(inventory.handoffs.length, 4);
    for (const handoff of inventory.handoffs) {
      assert.ok(handoff.annotation.includes("HANDOFF"));
      assert.ok(handoff.layerName.startsWith("Handoffs/"));
      assert.ok(handoff.from.length > 0);
      assert.ok(handoff.to.length > 0);
    }
  });
});
