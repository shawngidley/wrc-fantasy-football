import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyTank01Request, __clearTank01ProxyCacheForTests, isLiveGameWindow } from "./tank01Proxy";

describe("proxyTank01Request", () => {
  const originalApiKey = process.env.TANK01_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TANK01_API_KEY = "test-key";
    __clearTank01ProxyCacheForTests();
  });

  afterEach(() => {
    process.env.TANK01_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function responseMock() {
    const response = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return response;
  }

  it("uses a bounded upstream request for an allowed player endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ body: {} }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = responseMock();

    await proxyTank01Request({ params: { endpoint: "getNFLPlayerInfo" }, query: { playerName: "Mike Evans" } } as never, res as never);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("getNFLPlayerInfo?playerName=Mike+Evans"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns a gateway timeout when the upstream player request aborts", async () => {
    const timeout = Object.assign(new Error("request timed out"), { name: "TimeoutError" });
    global.fetch = vi.fn().mockRejectedValue(timeout);
    const res = responseMock();

    await proxyTank01Request({ params: { endpoint: "getNFLPlayerInfo" }, query: { playerName: "Mike Evans" } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ error: "Tank01 data request timed out" });
  });
});

describe("proxyTank01Request response caching", () => {
  const originalApiKey = process.env.TANK01_API_KEY;
  const originalFetch = global.fetch;
  const originalKillSwitch = process.env.TANK01_KILL_SWITCH;

  beforeEach(() => {
    process.env.TANK01_API_KEY = "test-key";
    process.env.TANK01_KILL_SWITCH = "off"; // these tests verify caching, not the kill switch
    __clearTank01ProxyCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.TANK01_API_KEY = originalApiKey;
    process.env.TANK01_KILL_SWITCH = originalKillSwitch;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function responseMock() {
    return {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  }

  function mockFetchAlwaysReturning(status: number, body: unknown) {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))
    );
  }

  it("serves a second request for the same endpoint+params from cache without hitting Tank01 again", async () => {
    mockFetchAlwaysReturning(200, { body: { score: 7 } });

    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260910_NE@SEA" } } as never, responseMock() as never);
    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260910_NE@SEA" } } as never, responseMock() as never);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("hits Tank01 again once the cache TTL has expired", async () => {
    mockFetchAlwaysReturning(200, { body: {} });

    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260910_NE@SEA" } } as never, responseMock() as never);
    vi.advanceTimersByTime(21_000); // just past the 20s TTL
    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260910_NE@SEA" } } as never, responseMock() as never);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps a slow-changing feed (news) cached well past the 20s live-data TTL", async () => {
    mockFetchAlwaysReturning(200, { body: [] });

    await proxyTank01Request({ params: { endpoint: "getNFLNews" }, query: { recentNews: "true" } } as never, responseMock() as never);
    vi.advanceTimersByTime(60_000); // 1 min: well past the 20s live TTL, well under news's 15 min
    await proxyTank01Request({ params: { endpoint: "getNFLNews" }, query: { recentNews: "true" } } as never, responseMock() as never);

    // Under the old flat 20s TTL this would have re-fetched; now it's one call.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not share the cache across different query params (different games)", async () => {
    mockFetchAlwaysReturning(200, { body: {} });

    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260910_NE@SEA" } } as never, responseMock() as never);
    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260913_ARI@LAC" } } as never, responseMock() as never);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed upstream response, so a transient error doesn't get stuck", async () => {
    global.fetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ error: "upstream error" }), { status: 502, headers: { "content-type": "application/json" } })))
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ body: {} }), { status: 200, headers: { "content-type": "application/json" } })));

    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260910_NE@SEA" } } as never, responseMock() as never);
    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "20260910_NE@SEA" } } as never, responseMock() as never);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("proxyTank01Request kill switch", () => {
  const originalApiKey = process.env.TANK01_API_KEY;
  const originalFetch = global.fetch;
  const originalKillSwitch = process.env.TANK01_KILL_SWITCH;

  beforeEach(() => {
    process.env.TANK01_API_KEY = "test-key";
    __clearTank01ProxyCacheForTests();
  });

  afterEach(() => {
    process.env.TANK01_API_KEY = originalApiKey;
    process.env.TANK01_KILL_SWITCH = originalKillSwitch;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function responseMock() {
    return {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  }

  it("does NOT block getNFLBoxScore by default (no env var set)", async () => {
    delete process.env.TANK01_KILL_SWITCH;
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ body: {} }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = responseMock();

    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "1" } } as never, res as never);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does NOT block getNFLGamesForWeek by default", async () => {
    delete process.env.TANK01_KILL_SWITCH;
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ body: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = responseMock();

    await proxyTank01Request({ params: { endpoint: "getNFLGamesForWeek" }, query: { week: "1" } } as never, res as never);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does NOT block when explicitly set to any value other than 'on'", async () => {
    process.env.TANK01_KILL_SWITCH = "off";
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ body: {} }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = responseMock();

    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "1" } } as never, res as never);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does NOT block unrelated endpoints (e.g. getNFLPlayerInfo), even when the switch is on", async () => {
    process.env.TANK01_KILL_SWITCH = "on";
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ body: {} }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = responseMock();

    await proxyTank01Request({ params: { endpoint: "getNFLPlayerInfo" }, query: { playerName: "Mike Evans" } } as never, res as never);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("blocks getNFLBoxScore once explicitly set to 'on'", async () => {
    process.env.TANK01_KILL_SWITCH = "on";
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ body: {} }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = responseMock();

    await proxyTank01Request({ params: { endpoint: "getNFLBoxScore" }, query: { gameID: "1" } } as never, res as never);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});

describe("isLiveGameWindow", () => {
  // Written as UTC instants so these don't depend on the machine's zone. EDT is
  // UTC-4, so 16:00Z is noon ET and 04:00Z is midnight ET.
  const et = (iso: string) => new Date(iso);

  it("is live through a normal game-day slate", () => {
    expect(isLiveGameWindow(et("2026-10-04T13:30:00Z"))).toBe(true); // Sun 9:30am ET, London kickoff
    expect(isLiveGameWindow(et("2026-10-04T17:00:00Z"))).toBe(true); // Sun 1pm ET
    expect(isLiveGameWindow(et("2026-10-05T00:20:00Z"))).toBe(true); // Sun 8:20pm ET, SNF
    expect(isLiveGameWindow(et("2026-10-06T00:15:00Z"))).toBe(true); // Mon 8:15pm ET, MNF
    expect(isLiveGameWindow(et("2026-10-09T00:15:00Z"))).toBe(true); // Thu 8:15pm ET, TNF
    expect(isLiveGameWindow(et("2026-12-26T18:00:00Z"))).toBe(true); // Sat 1pm ET, late-season
  });

  // The case the day-of-week check gets wrong on its own: a night game in
  // overtime is still the previous day's slate after midnight ET, and dropping
  // out of the window there would leave Live Scoring 15 minutes stale during
  // the fourth quarter.
  it("stays live for a night game that runs past midnight ET", () => {
    expect(isLiveGameWindow(et("2026-10-06T04:30:00Z"))).toBe(true); // Tue 12:30am ET = Monday night
    expect(isLiveGameWindow(et("2026-10-09T04:30:00Z"))).toBe(true); // Fri 12:30am ET = Thursday night
    expect(isLiveGameWindow(et("2026-10-05T05:45:00Z"))).toBe(true); // Mon 1:45am ET = Sunday night
  });

  it("is off overnight once every game has ended", () => {
    expect(isLiveGameWindow(et("2026-10-05T06:00:00Z"))).toBe(false); // Mon 2am ET
    expect(isLiveGameWindow(et("2026-10-05T11:00:00Z"))).toBe(false); // Mon 7am ET
  });

  it("is off all day Tuesday and Wednesday, which have no slate", () => {
    expect(isLiveGameWindow(et("2026-10-06T17:00:00Z"))).toBe(false); // Tue 1pm ET
    expect(isLiveGameWindow(et("2026-10-07T00:15:00Z"))).toBe(false); // Tue 8:15pm ET
    expect(isLiveGameWindow(et("2026-10-07T17:00:00Z"))).toBe(false); // Wed 1pm ET
    expect(isLiveGameWindow(et("2026-10-08T04:30:00Z"))).toBe(false); // Thu 12:30am ET = Wednesday night
  });

  // The ET conversion has to follow the standard-time shift, not a fixed offset.
  it("tracks the EST/EDT shift", () => {
    expect(isLiveGameWindow(et("2026-11-29T18:00:00Z"))).toBe(true);  // Sun 1pm EST
    expect(isLiveGameWindow(et("2026-11-30T12:00:00Z"))).toBe(false); // Mon 7am EST
  });
});
