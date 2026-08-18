import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: { from },
}));

import { releaseUnprotectedPlayers } from "./protectionRelease";

function queuedReleaseQueries({ protectedIds, rosteredIds }: { protectedIds: string[]; rosteredIds: string[] }) {
  const releaseUpdate = {
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  from
    .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: protectedIds.map(player_id => ({ player_id })), error: null }) })
    .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ data: rosteredIds.map(id => ({ id })), error: null }) }) })
    .mockReturnValueOnce({ update: vi.fn().mockReturnValue(releaseUpdate) });
  return releaseUpdate;
}

describe("releaseUnprotectedPlayers", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("does not inspect or change player availability before the deadline", async () => {
    const result = await releaseUnprotectedPlayers(Date.parse("2026-08-27T00:59:59.999Z"));

    expect(result).toEqual({ released: 0, skipped: "before-deadline" });
    expect(from).not.toHaveBeenCalled();
  });

  it("releases only rostered players without a protection after the deadline", async () => {
    const releaseUpdate = queuedReleaseQueries({ protectedIds: ["protected"], rosteredIds: ["protected", "unprotected-a", "unprotected-b"] });

    await expect(releaseUnprotectedPlayers(Date.parse("2026-08-27T01:00:00.000Z"))).resolves.toEqual({ released: 2, skipped: null });
    expect(releaseUpdate.in).toHaveBeenCalledWith("id", ["unprotected-a", "unprotected-b"]);
  });

  it("is idempotent once every remaining rostered player is protected", async () => {
    queuedReleaseQueries({ protectedIds: ["protected"], rosteredIds: ["protected"] });

    await expect(releaseUnprotectedPlayers(Date.parse("2026-08-27T01:00:00.000Z"))).resolves.toEqual({ released: 0, skipped: "already-released" });
    expect(from).toHaveBeenCalledTimes(2);
  });
});
