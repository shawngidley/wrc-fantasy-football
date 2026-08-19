import { describe, expect, it } from "vitest";
import { getTradePickKey, serializeTradePick } from "@/lib/tradePickPayload";

describe("trade pick payload", () => {
  it("retains the original-team identity needed to validate an acquired same-round pick", () => {
    const pick = serializeTradePick({ year: 2026, round: 7, originalTeamId: "team-vipers" });

    expect(pick).toEqual({ year: 2026, round: 7, originalTeamId: "team-vipers" });
    expect(getTradePickKey(pick)).toBe("2026-7-team-vipers");
  });

  it("keeps a legacy unqualified pick compatible with existing proposals", () => {
    expect(serializeTradePick({ year: 2027, round: 4 })).toEqual({ year: 2027, round: 4 });
  });
});
