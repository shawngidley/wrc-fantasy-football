import { describe, expect, it } from "vitest";
import { TRADE_ALERT_TEXT, isMissingAlertColumnError, leagueAlertSaveErrorMessage, tradeAlertRecipients } from "./tradeAlert";

const teams = [
  { id: "team-a", phone_number: "216-555-0001", sms_league_trade_alerts: true },
  { id: "team-b", phone_number: "216-555-0002" },
  { id: "team-c", phone_number: "216-555-0003", sms_league_trade_alerts: false },
  { id: "team-d", phone_number: null, sms_league_trade_alerts: true },
  { id: "team-e", phone_number: "  ", sms_league_trade_alerts: true },
];

describe("trade alert", () => {
  it("texts every owner with a number by default, even without the column", () => {
    expect(tradeAlertRecipients(teams)).toEqual(["216-555-0001", "216-555-0002"]);
  });

  it("skips owners switched off", () => {
    expect(tradeAlertRecipients(teams)).not.toContain("216-555-0003");
  });

  it("skips excluded teams such as the proposer", () => {
    expect(tradeAlertRecipients(teams, ["team-a"])).toEqual(["216-555-0002"]);
  });

  it("never texts the same handset twice", () => {
    const shared = [
      { id: "team-a", phone_number: "216-555-0001" },
      { id: "team-b", phone_number: " 216-555-0001 " },
    ];
    expect(tradeAlertRecipients(shared)).toEqual(["216-555-0001"]);
  });

  it("uses the agreed wording", () => {
    expect(TRADE_ALERT_TEXT).toBe("🚨🚨 TRADE ALERT 🚨🚨 A trade has been completed in the WRC!");
  });
});

describe("isMissingAlertColumnError", () => {
  it("recognizes the column not existing yet", () => {
    expect(isMissingAlertColumnError({ code: "42703", message: 'column teams.sms_league_trade_alerts does not exist' })).toBe(true);
    expect(isMissingAlertColumnError({ code: null, message: "could not find sms_league_trade_alerts" })).toBe(true);
  });

  // The reason this predicate exists: retrying on any error at all would make
  // a transient failure re-run the query without the opt-out column, and every
  // owner who switched alerts off would be texted anyway.
  it("does not treat an unrelated failure as a missing column", () => {
    for (const error of [
      { code: "57014", message: "canceling statement due to statement timeout" },
      { code: "42501", message: "permission denied for table teams" },
      { code: "08006", message: "connection failure" },
      { code: null, message: "column teams.phone_number does not exist" },
    ]) {
      expect(isMissingAlertColumnError(error), error.message).toBe(false);
    }
  });

  it("is false for no error at all", () => {
    expect(isMissingAlertColumnError(null)).toBe(false);
    expect(isMissingAlertColumnError(undefined)).toBe(false);
  });
});

describe("leagueAlertSaveErrorMessage", () => {
  it("names the migration when the column does not exist yet", () => {
    const message = leagueAlertSaveErrorMessage({ code: "42703", message: "column does not exist" });
    expect(message).toContain("supabase_league_trade_alerts.sql");
  });

  it("stays generic for any other failure", () => {
    expect(leagueAlertSaveErrorMessage({ code: "57014", message: "statement timeout" }))
      .toBe("Unable to save league trade alert setting.");
  });
});
