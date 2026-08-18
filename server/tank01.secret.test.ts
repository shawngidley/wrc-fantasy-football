import { describe, expect, it } from "vitest";

describe("Tank01 API credential configuration", () => {
  it("is available to the server-side allowlisted proxy without making a live provider request", () => {
    const apiKey = process.env.TANK01_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(apiKey).toMatch(/\S/);
  });
});
