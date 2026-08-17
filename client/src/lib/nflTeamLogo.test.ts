import { describe, expect, it } from "vitest";
import { getNflTeamLogoUrl } from "./nflTeamLogo";

describe("getNflTeamLogoUrl", () => {
  it("uses ESPN's Jaguars asset slug for either Jaguars abbreviation", () => {
    expect(getNflTeamLogoUrl("JAC")).toBe("https://a.espncdn.com/i/teamlogos/nfl/500/jax.png");
    expect(getNflTeamLogoUrl("JAX")).toBe("https://a.espncdn.com/i/teamlogos/nfl/500/jax.png");
  });

  it("normalizes upstream team codes before building the logo URL", () => {
    expect(getNflTeamLogoUrl("KAN")).toBe("https://a.espncdn.com/i/teamlogos/nfl/500/kc.png");
    expect(getNflTeamLogoUrl("nyg")).toBe("https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png");
  });
});
