import { describe, expect, it } from "vitest";
import { earningsIdForOwner, PRIZE_AMOUNTS } from "./prizeEarnings";

describe("earningsIdForOwner", () => {
  it("matches the earnings/money_owed id convention for every owner", () => {
    expect(earningsIdForOwner("Greg")).toBe("greg");
    expect(earningsIdForOwner("David S.")).toBe("davids");
    expect(earningsIdForOwner("David R.")).toBe("davidr");
    expect(earningsIdForOwner("Scott M.")).toBe("scottm");
    expect(earningsIdForOwner("Scott N.")).toBe("scottn");
  });
});

describe("PRIZE_AMOUNTS", () => {
  it("matches the Money page prize structure", () => {
    expect(PRIZE_AMOUNTS.gow).toBe(30);
    expect(PRIZE_AMOUNTS.wild_card).toBe(50);
    expect(PRIZE_AMOUNTS.divisional).toBe(100);
    expect(PRIZE_AMOUNTS.super_bowl).toBe(300);
    expect(PRIZE_AMOUNTS.champ).toBe(600);
  });
});
