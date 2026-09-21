import { describe, expect, it } from "vitest";
import { GROUP_POLL_MS, summaryLeaksSecret, type GroupSummary } from "./groups";

describe("group planning helpers", () => {
  it("polls instead of opening a websocket", () => {
    expect(GROUP_POLL_MS).toBeGreaterThanOrEqual(1000);
  });

  it("never treats unshared preference text as part of the summary", () => {
    const summary: GroupSummary = {
      sources: ["votes", "shared_preferences"],
      agreement: [{ label: "Cedar tasting", yes: 2, no: 0 }],
      disagreement: [],
      tradeoffs: [{ note: "Keep high-agreement items." }],
      shared_preferences: [{ user_id: "1", preferences: { default_group_size: 4 } }],
    };
    expect(summaryLeaksSecret(summary, "unshared-private-club")).toBe(false);
  });
});
