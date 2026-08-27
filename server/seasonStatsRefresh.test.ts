import { beforeEach, describe, expect, it, vi } from "vitest";

const { snapshotMock, upsertMock, fromMock } = vi.hoisted(() => ({
  snapshotMock: vi.fn(),
  upsertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("./seasonStatsSnapshot", () => ({ getCompletedOffenseSnapshot: snapshotMock }));
vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { refreshSharedSeasonStats } from "./seasonStatsRefresh";

describe("refreshSharedSeasonStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({ upsert: upsertMock });
  });

  it("forces a fresh shared snapshot and upserts it into the durable cache", async () => {
    upsertMock.mockResolvedValue({ error: null });
    snapshotMock.mockResolvedValue({ "Josh Downs": { games: 16 }, "Geno Smith": { games: 15 } });

    await expect(refreshSharedSeasonStats()).resolves.toEqual({ playerCount: 2 });
    expect(snapshotMock).toHaveBeenCalledWith({ force: true });
    expect(fromMock).toHaveBeenCalledWith("wrc_season_stats_cache");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "completed-offense-2025-id-resolved-v5",
      season: 2025,
      source: "nflverse-completed-2025-play-by-play-reconciled-v4",
    }), { onConflict: "id" });
  });
});
