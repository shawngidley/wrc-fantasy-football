import { describe, expect, it } from "vitest";

describe("Tank01 API credential", () => {
  it("authorizes a lightweight weekly games request", async () => {
    const apiKey = process.env.TANK01_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(
      "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLGamesForWeek?week=1&seasonType=Regular%20Season&season=2026",
      {
        headers: {
          "x-rapidapi-key": apiKey!,
          "x-rapidapi-host": "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );

    expect(response.status).toBe(200);
  }, 20_000);
});
