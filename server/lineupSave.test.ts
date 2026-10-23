import { describe, expect, it, vi } from "vitest";
import { replaceLineupRows } from "./lineupSave";

const rows = [
  { slot: "QB", player_id: "a", player_name: "Caleb Williams", is_bench: false },
  { slot: "BENCH_0", player_id: "b", player_name: "Blake Corum", is_bench: true },
];

function fakeClient(rpcResult: { code?: string; message?: string } | null) {
  const calls: string[] = [];
  const eq3 = vi.fn(() => { calls.push("delete"); return Promise.resolve({ error: null }); });
  const eq2 = vi.fn(() => ({ eq: eq3 }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const insert = vi.fn((_rows: unknown) => { calls.push("insert"); return Promise.resolve({ error: null }); });
  const client = {
    rpc: vi.fn(() => { calls.push("rpc"); return Promise.resolve({ data: null, error: rpcResult }); }),
    from: vi.fn(() => ({ delete: () => ({ eq: eq1 }), insert })),
  };
  return { client, calls, insert };
}

describe("replaceLineupRows", () => {
  it("replaces the lineup in one rpc call and touches nothing else", async () => {
    const { client, calls } = fakeClient(null);
    await replaceLineupRows("team-scottn", 7, 2026, rows, client);
    expect(calls).toEqual(["rpc"]);
    expect(client.rpc).toHaveBeenCalledWith("replace_lineup", { p_team_id: "team-scottn", p_week: 7, p_season: 2026, p_rows: rows });
  });

  it("falls back to delete then insert while the SQL function has not been created yet", async () => {
    const { client, calls, insert } = fakeClient({ code: "PGRST202", message: "Could not find the function public.replace_lineup" });
    await replaceLineupRows("team-scottn", 7, 2026, rows, client);
    expect(calls).toEqual(["rpc", "delete", "insert"]);
    expect(insert).toHaveBeenCalledWith(rows.map(r => ({ ...r, team_id: "team-scottn", week: 7, season: 2026 })));
  });

  it("recognizes the Postgres wording for a missing function too", async () => {
    const { client, calls } = fakeClient({ message: "function public.replace_lineup(text, integer, integer, jsonb) does not exist" });
    await replaceLineupRows("team-scottn", 7, 2026, rows, client);
    expect(calls).toEqual(["rpc", "delete", "insert"]);
  });

  it("does not fall back on a real rpc failure, so nothing is half written", async () => {
    const { client, calls } = fakeClient({ code: "23505", message: "duplicate key" });
    await expect(replaceLineupRows("team-scottn", 7, 2026, rows, client)).rejects.toThrow("Unable to save lineup");
    expect(calls).toEqual(["rpc"]);
  });

  // A schema error is not a missing function. Falling back on one of these
  // would delete the team's lineup and then fail the insert, leaving the week
  // with no lineup at all -- the failure the transaction exists to prevent.
  it("does not fall back when some other object does not exist", async () => {
    for (const message of [
      `column "is_bench" does not exist`,
      `relation "public.lineups" does not exist`,
    ]) {
      const { client, calls } = fakeClient({ code: "42703", message });
      await expect(replaceLineupRows("team-scottn", 7, 2026, rows, client)).rejects.toThrow("Unable to save lineup");
      expect(calls, message).toEqual(["rpc"]);
    }
  });
});
