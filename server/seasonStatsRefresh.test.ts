import { beforeEach, describe, expect, it, vi } from "vitest";

const { snapshotMock, getDbMock } = vi.hoisted(() => ({
  snapshotMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("./seasonStatsSnapshot", () => ({ getCompletedOffenseSnapshot: snapshotMock }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { refreshSharedSeasonStats } from "./seasonStatsRefresh";

describe("refreshSharedSeasonStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forces a fresh shared snapshot and upserts it into the durable cache", async () => {
    const onDuplicateKeyUpdate = vi.fn();
    const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
    getDbMock.mockResolvedValue({ insert: vi.fn(() => ({ values })) });
    snapshotMock.mockResolvedValue({ "Josh Downs": { games: 16 }, "Geno Smith": { games: 15 } });

    await expect(refreshSharedSeasonStats()).resolves.toEqual({ playerCount: 2 });
    expect(snapshotMock).toHaveBeenCalledWith({ force: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      id: "completed-offense-2025-id-resolved-v4",
      season: 2025,
      source: "nflverse-completed-2025-id-resolved",
    }));
    expect(onDuplicateKeyUpdate).toHaveBeenCalledOnce();
  });
});
