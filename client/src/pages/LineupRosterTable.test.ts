/* @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LineupRosterTable } from "./Lineup";
import { DST_SEASON_STATS_2025 } from "@/lib/dstSeasonStats2025";
import { normalizeCompletedDstSeasonStats } from "@/lib/playerSeasonStats";

const starter = { id: "tb", name: "Tampa Bay Buccaneers", nflTeam: "TB", pos: "DST", pts: 0, proj: 8.3, status: "Active", slot: "DST", byeWeek: 9 };
const candidate = { id: "gb", name: "Green Bay Packers", nflTeam: "GB", pos: "DST", pts: 0, proj: 7.5, status: "Active", isBench: true, byeWeek: 5 };

describe("LineupRosterTable D/ST candidate rows", () => {
  it("uses the requested SK, SFT, TA, and TDDST mapping in both standard and expanded candidate rows", () => {
    const html = renderToStaticMarkup(createElement(LineupRosterTable, {
      title: "D/ST · 2 players",
      profile: "DST",
      players: [starter],
      statMap: {
        "tampa bay buccaneers": normalizeCompletedDstSeasonStats(DST_SEASON_STATS_2025.TB),
        "green bay packers": normalizeCompletedDstSeasonStats(DST_SEASON_STATS_2025.GB),
      },
      metaMap: {},
      matchupMap: {} as never,
      injuries: [],
      selectedId: "tampabaybuccaneers",
      isReadOnly: false,
      onSelect: () => undefined,
      onPlayerClick: () => undefined,
      getInlineChoices: () => [candidate],
      onInlineSwap: () => undefined,
    }));

    expect(html).toContain("SK");
    expect(html).toContain("SFT");
    expect(html).toContain("TA");
    expect(html).toContain("TDDST");
    expect(html).toContain("Tampa Bay Buccaneers");
    expect(html).toContain("Green Bay Packers");
    expect(html).toContain('aria-label="Move Green Bay Packers into DST"');
    expect((html.match(/>37</g) ?? []).length).toBe(1);
    expect((html.match(/>1</g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((html.match(/>23</g) ?? []).length).toBe(1);
    expect((html.match(/>14</g) ?? []).length).toBe(1);
  });

  it("uses only Slot controls for swap actions while Player cells keep Player Card navigation", () => {
    const onSelect = vi.fn();
    const onPlayerClick = vi.fn();
    const onInlineSwap = vi.fn();
    render(createElement(LineupRosterTable, {
      title: "D/ST · 2 players",
      profile: "DST",
      players: [starter],
      statMap: {
        "tampa bay buccaneers": normalizeCompletedDstSeasonStats(DST_SEASON_STATS_2025.TB),
        "green bay packers": normalizeCompletedDstSeasonStats(DST_SEASON_STATS_2025.GB),
      },
      metaMap: {},
      matchupMap: {} as never,
      injuries: [],
      selectedId: "tampabaybuccaneers",
      isReadOnly: false,
      onSelect,
      onPlayerClick,
      getInlineChoices: () => [candidate],
      onInlineSwap,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Change Tampa Bay Buccaneers in DST" }));
    expect(onSelect).toHaveBeenCalledWith(starter);

    fireEvent.click(screen.getByText("Tampa Bay Buccaneers").closest("td")!);
    expect(onPlayerClick).toHaveBeenCalledWith(starter);
    expect(onInlineSwap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Move Green Bay Packers into DST" }));
    expect(onInlineSwap).toHaveBeenCalledWith(starter, candidate);

    fireEvent.click(screen.getByText("Green Bay Packers").closest("td")!);
    expect(onPlayerClick).toHaveBeenCalledWith(candidate);
    expect(onInlineSwap).toHaveBeenCalledTimes(1);
  });
});
