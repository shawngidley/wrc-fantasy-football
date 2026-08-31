import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: { from },
}));

import { releaseUnprotectedPlayers } from "./protectionRelease";

function queuedReleaseQueries({ protectedIds, rosteredIds, draftStarted = false }: { protectedIds: string[]; rosteredIds: string[]; draftStarted?: boolean }) {
  const releaseUpdate = {
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  from
    .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { started: draftStarted }, error: null }) }) }) })
    .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: protectedIds.map(player_id => ({ player_id })), error: null }) })
    .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ data: rosteredIds.map(id => ({ id })), error: null }) }) })
    .mockReturnValueOnce({ update: vi.fn().mockReturnValue(releaseUpdate) });
  return releaseUpdate;
}

function queuedDraftStateOnly(draftStarted: boolean) {
  from.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { started: draftStarted }, error: null }) }) }) });
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

  it("refuses to run once the draft has started, even after the deadline", async () => {
    // This is the exact scenario that previously wiped every drafted
    // player's roster assignment down to just protections: the deadline
    // has long since passed, but the draft has also already happened, so
    // treating every drafted (non-protected) player as releasable is wrong.
    queuedDraftStateOnly(true);

    const result = await releaseUnprotectedPlayers(Date.parse("2026-08-27T01:00:00.000Z"));

    expect(result).toEqual({ released: 0, skipped: "draft-already-started" });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("releases only rostered players without a protection after the deadline", async () => {
    const releaseUpdate = queuedReleaseQueries({ protectedIds: ["protected"], rosteredIds: ["protected", "unprotected-a", "unprotected-b"] });

    await expect(releaseUnprotectedPlayers(Date.parse("2026-08-27T01:00:00.000Z"))).resolves.toEqual({ released: 2, skipped: null });
    expect(releaseUpdate.in).toHaveBeenCalledWith("id", ["unprotected-a", "unprotected-b"]);
  });

  it("is idempotent once every remaining rostered player is protected", async () => {
    queuedReleaseQueries({ protectedIds: ["protected"], rosteredIds: ["protected"] });

    await expect(releaseUnprotectedPlayers(Date.parse("2026-08-27T01:00:00.000Z"))).resolves.toEqual({ released: 0, skipped: "already-released" });
    expect(from).toHaveBeenCalledTimes(3);
  });
});
