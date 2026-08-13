import { describe, expect, it } from "vitest";

describe("FantasyPros API credential", () => {
  it("authorizes a lightweight player metadata request", async () => {
    const apiKey = process.env.FANTASYPROS_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(
      "https://api.fantasypros.com/public/v2/json/nfl/players?limit=1",
      {
        headers: { "x-api-key": apiKey! },
        signal: AbortSignal.timeout(15_000),
      },
    );

    expect(response.status).toBe(200);
  }, 20_000);
});
