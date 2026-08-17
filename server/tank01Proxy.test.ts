import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyTank01Request } from "./tank01Proxy";

describe("proxyTank01Request", () => {
  const originalApiKey = process.env.TANK01_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TANK01_API_KEY = "test-key";
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
