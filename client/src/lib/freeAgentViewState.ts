/**
 * Remembers how the Free Agents page was set up (position, sort, search,
 * list, tab and scroll spot) for the length of the browser tab, so Back from
 * a player page returns to the same view instead of the defaults.
 *
 * Stored in sessionStorage: it survives moving between pages and a refresh,
 * and it goes away when the tab closes. Every read is validated, because the
 * stored text could be stale or damaged, and storage can be blocked entirely.
 */
import { AVAILABLE_STATS_YEARS } from "@/lib/scheduleData2026";

export const FREE_AGENT_VIEW_KEY = "wrc_free_agents_view_v1";

export interface FreeAgentViewState {
  posFilter: string;
  search: string;
  sortKey: string;
  sortDirection: "asc" | "desc";
  playerScope: "fa" | "all";
  activeView: "pool" | "watchlist";
  activeTab: "pool" | "bids" | "myBids";
  selectedStatsYear: number | null;
  scrollY: number;
}

const POSITIONS = ["SFLEX", "QB", "RB", "WR", "TE", "K", "DST"];

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readFreeAgentViewState(storage: StorageLike | null = defaultStorage()): FreeAgentViewState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(FREE_AGENT_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || typeof v !== "object") return null;
    const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
      allowed.includes(value as T) ? (value as T) : fallback;
    return {
      posFilter: pick(v.posFilter, POSITIONS, "SFLEX"),
      search: typeof v.search === "string" ? v.search.slice(0, 100) : "",
      sortKey: typeof v.sortKey === "string" && v.sortKey ? v.sortKey : "wrcPts",
      sortDirection: pick(v.sortDirection, ["asc", "desc"] as const, "desc"),
      playerScope: pick(v.playerScope, ["fa", "all"] as const, "fa"),
      activeView: pick(v.activeView, ["pool", "watchlist"] as const, "pool"),
      activeTab: pick(v.activeTab, ["pool", "bids", "myBids"] as const, "pool"),
      // Only a year the page still offers: the stats-year select has no option
      // for anything else, so restoring one would blank the control and ask the
      // stats queries for a season with no data.
      selectedStatsYear: typeof v.selectedStatsYear === "number" && AVAILABLE_STATS_YEARS.includes(v.selectedStatsYear) ? v.selectedStatsYear : null,
      scrollY: typeof v.scrollY === "number" && Number.isFinite(v.scrollY) && v.scrollY > 0 ? Math.round(v.scrollY) : 0,
    };
  } catch {
    return null;
  }
}

export function writeFreeAgentViewState(state: FreeAgentViewState, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(FREE_AGENT_VIEW_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the page still works, it just won't be remembered.
  }
}
