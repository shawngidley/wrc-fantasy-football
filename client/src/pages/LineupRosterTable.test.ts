/* @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LineupRosterTable, mobileLineupName } from "./Lineup";
import { DST_SEASON_STATS_2025 } from "@/lib/dstSeasonStats2025";
import { normalizeCompletedDstSeasonStats, normalizeTankSeasonStats } from "@/lib/playerSeasonStats";

const starter = { id: "tb", name: "Tampa Bay Buccaneers", nflTeam: "TB", pos: "DST", pts: 0, proj: 8.3, status: "Active", slot: "DST", byeWeek: 9 };
const candidate = { id: "gb", name: "Green Bay Packers", nflTeam: "GB", pos: "DST", pts: 0, proj: 7.5, status: "Active", isBench: true, byeWeek: 5 };

describe("LineupRosterTable D/ST candidate rows", () => {
  it("uses first-initial plus last-name mobile labels for individual players while preserving D/ST names", () => {
    expect(mobileLineupName({ name: "Justin Jefferson", pos: "WR" })).toBe("J. Jefferson");
    expect(mobileLineupName({ name: "Tampa Bay Buccaneers", pos: "DST" })).toBe("Tampa Bay Buccaneers");
  });

  it("renders populated GP as the final stat in SFLEX, K, and D/ST panels", () => {
    const shared = {
      title: "GP validation", metaMap: {}, matchupMap: {} as never, injuries: [], selectedId: null,
      isReadOnly: true, onSelect: () => undefined, onPlayerClick: () => undefined,
      getInlineChoices: () => [], onInlineSwap: () => undefined,
    };
    const seventeenGames = normalizeTankSeasonStats({ gamesPlayed: "17" } as never, "QB");
    const profiles = [
      { profile: "SFLEX" as const, player: { id: "sf", name: "Test Quarterback", nflTeam: "TB", pos: "QB", pts: 0, proj: 0, status: "Active", slot: "QB", byeWeek: 9 }, stats: seventeenGames },
      { profile: "K" as const, player: { id: "k", name: "Test Kicker", nflTeam: "TB", pos: "K", pts: 0, proj: 0, status: "Active", slot: "K", byeWeek: 9 }, stats: seventeenGames },
      { profile: "DST" as const, player: starter, stats: normalizeCompletedDstSeasonStats(DST_SEASON_STATS_2025.TB) },
    ];

    profiles.forEach(({ profile, player, stats }) => {
      const html = renderToStaticMarkup(createElement(LineupRosterTable, {
        ...shared, profile, players: [player], statMap: { [player.name.toLowerCase()]: stats },
      }));
      expect(html).toMatch(/>GP<\/th>.*>17<\/td>/s);
    });
  });

  it("keeps Proj, FPTS, and FP/G together beneath one Fantasy header before each profile's stat block", () => {
    const shared = {
      title: "Column-order validation", metaMap: {}, matchupMap: {} as never, injuries: [], selectedId: null,
      isReadOnly: true, onSelect: () => undefined, onPlayerClick: () => undefined,
      getInlineChoices: () => [], onInlineSwap: () => undefined,
    };
    const profiles = [
      { profile: "SFLEX" as const, player: { id: "sf", name: "Test Quarterback", nflTeam: "TB", pos: "QB", pts: 0, proj: 0, status: "Active", slot: "QB", byeWeek: 9 }, statLabel: "YDS" },
      { profile: "K" as const, player: { id: "k", name: "Test Kicker", nflTeam: "TB", pos: "K", pts: 0, proj: 0, status: "Active", slot: "K", byeWeek: 9 }, statLabel: "FGM" },
      { profile: "DST" as const, player: starter, statLabel: "SK" },
    ];

    profiles.forEach(({ profile, player, statLabel }) => {
      const html = renderToStaticMarkup(createElement(LineupRosterTable, {
        ...shared, profile, players: [player], statMap: { [player.name.toLowerCase()]: normalizeTankSeasonStats({ gamesPlayed: "17" } as never, player.pos) },
      }));
      const headerMarkup = html.match(/<thead>(.*?)<\/thead>/s)?.[1] ?? "";
      const projectionHeader = headerMarkup.indexOf(">PROJ</th>");
      const statHeader = headerMarkup.indexOf(`>${statLabel}</th>`);
      const fantasyHeader = headerMarkup.indexOf(">FPTS</th>");
      const pointsPerGameHeader = headerMarkup.indexOf(">FP/G</th>");

      expect(projectionHeader).toBeGreaterThan(-1);
      expect(fantasyHeader).toBeGreaterThan(projectionHeader);
      expect(pointsPerGameHeader).toBeGreaterThan(fantasyHeader);
      expect(statHeader).toBeGreaterThan(pointsPerGameHeader);
      expect(headerMarkup).not.toContain(">PROJECTION</th>");
      expect(headerMarkup.match(/>FANTASY<\/th>/g)).toHaveLength(1);
    });
  });

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
    expect(html).toContain(">GP<");
    expect(html).toContain("Tampa Bay Buccaneers");
    expect(html).toContain("Green Bay Packers");
    expect(html).toContain('aria-label="Move Green Bay Packers into DST"');
    expect((html.match(/>37</g) ?? []).length).toBe(1);
    expect((html.match(/>1</g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((html.match(/>23</g) ?? []).length).toBe(1);
    expect((html.match(/>14</g) ?? []).length).toBe(1);
    expect((html.match(/>17</g) ?? []).length).toBe(2);
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

    fireEvent.click(screen.getAllByText("Tampa Bay Buccaneers")[0].closest("td")!);
    expect(onPlayerClick).toHaveBeenCalledWith(starter);
    expect(onInlineSwap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Move Green Bay Packers into DST" }));
    expect(onInlineSwap).toHaveBeenCalledWith(starter, candidate);

    fireEvent.click(screen.getAllByText("Green Bay Packers")[0].closest("td")!);
    expect(onPlayerClick).toHaveBeenCalledWith(candidate);
    expect(onInlineSwap).toHaveBeenCalledTimes(1);
  });
});
