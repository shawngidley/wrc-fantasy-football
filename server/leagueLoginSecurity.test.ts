import { describe, expect, it } from "vitest";
import { assertLoginAllowed, assertStrongLeaguePin, clearLoginFailures, isWeakLeaguePin, recordLoginFailure } from "./leagueLoginSecurity";

describe("league PIN security", () => {
  it("rejects default, repeated, sequential, and short PINs", () => {
    expect(isWeakLeaguePin("1234")).toBe(true);
    expect(isWeakLeaguePin("111111")).toBe(true);
    expect(isWeakLeaguePin("123456")).toBe(true);
    expect(() => assertStrongLeaguePin("1234")).toThrow("six to twelve digits");
    expect(() => assertStrongLeaguePin("sixdigit")).toThrow("six to twelve digits");
  });

  it("allows a non-trivial six-digit PIN", () => {
    expect(isWeakLeaguePin("482917")).toBe(false);
    expect(() => assertStrongLeaguePin("482917")).not.toThrow();
  });

  it("temporarily locks a team and IP after repeated failed attempts", () => {
    const teamId = "test-team";
    const ip = "198.51.100.25";
    clearLoginFailures(teamId, ip);
    for (let attempt = 0; attempt < 5; attempt += 1) recordLoginFailure(teamId, ip, 1_000);
    expect(() => assertLoginAllowed(teamId, ip, 1_001)).toThrow("Too many PIN attempts");
    clearLoginFailures(teamId, ip);
  });
});
