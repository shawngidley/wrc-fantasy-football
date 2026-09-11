import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyTank01Request, __clearTank01ProxyCacheForTests } from "./tank01Proxy";

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
