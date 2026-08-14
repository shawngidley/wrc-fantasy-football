import { describe, expect, it } from "vitest";
import { redactLeagueTeam } from "./leagueAuth";

describe("redactLeagueTeam", () => {
  it("returns public team identity without a PIN or PIN hash", () => {
    const team = redactLeagueTeam({
      id: "team-shawn",
      name: "Vipers",
      owner: "Shawn",
      division: "West",
      faab: 200,
      wins: 0,
      losses: 0,
      ties: 0,
      points_for: 0,
      points_against: 0,
      is_commissioner: true,
      pin: "1234",
      pin_hash: "sensitive",
    });

    expect(team).toMatchObject({ id: "team-shawn", name: "Vipers", is_commissioner: true });
    expect(team).not.toHaveProperty("pin");
    expect(team).not.toHaveProperty("pin_hash");
  });
});
