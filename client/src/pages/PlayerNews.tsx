/**
 * WRC Fantasy Football - Players Page
 * Tab 1: Player Browser — search/filter, season stats, FAAB bid panel,
 *         inline injury news, watchlist stars
 * Tab 2: Injury News feed
 */
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, AlertTriangle, Activity, Users, Newspaper,
  Star, ChevronDown, ChevronUp, DollarSign, Check, X,
} from "lucide-react";
import { toast } from "sonner";

// ── Current week ──────────────────────────────────────────────────────────────
const CURRENT_WEEK = 14;
// Logged-in team's remaining FAAB (mock)
const MY_FAAB = 312;

// ── Types ─────────────────────────────────────────────────────────────────────
interface SeasonStats {
  gp: number;
  passYds?: number; passTd?: number; passInt?: number;
  rushYds?: number; rushTd?: number; rushAtt?: number;
  rec?: number; recYds?: number; recTd?: number;
  fgm?: number; fga?: number; xpm?: number;
  sacks?: number; defInt?: number; defTd?: number; pa?: number;
}

interface NFLPlayer {
  id: string;
  name: string;
  pos: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  nflTeam: string;
  status: string;
  owned: boolean;
  ownerTeam?: string;
  seasonFpts: number;
  byeWeek: number;
  seasonStats: SeasonStats;
  injuryNote?: string; // latest injury headline
}

// ── Mock player pool ───────────────────────────────────────────────────────────
const PLAYERS: NFLPlayer[] = [
  { id: "p1",  name: "Josh Allen",          pos: "QB",  nflTeam: "BUF", status: "Active", owned: true,  ownerTeam: "Team Gidley",  byeWeek: 12, seasonFpts: 412.8, seasonStats: { gp: 13, passYds: 3842, passTd: 32, passInt: 6,  rushYds: 524, rushTd: 7 } },
  { id: "p2",  name: "Lamar Jackson",        pos: "QB",  nflTeam: "BAL", status: "Active", owned: true,  ownerTeam: "Team Gidley",  byeWeek: 14, seasonFpts: 448.2, seasonStats: { gp: 13, passYds: 3124, passTd: 28, passInt: 4,  rushYds: 812, rushTd: 11 } },
  { id: "p3",  name: "Patrick Mahomes",      pos: "QB",  nflTeam: "KC",  status: "Active", owned: true,  ownerTeam: "Team Sotka",   byeWeek: 6,  seasonFpts: 388.4, seasonStats: { gp: 13, passYds: 3612, passTd: 30, passInt: 8,  rushYds: 248, rushTd: 3 } },
  { id: "p4",  name: "Jalen Hurts",          pos: "QB",  nflTeam: "PHI", status: "Active", owned: true,  ownerTeam: "Team Nelson",  byeWeek: 5,  seasonFpts: 362.6, seasonStats: { gp: 13, passYds: 2984, passTd: 24, passInt: 5,  rushYds: 612, rushTd: 10 } },
  { id: "p5",  name: "Dak Prescott",         pos: "QB",  nflTeam: "DAL", status: "Active", owned: true,  ownerTeam: "Team Sotka",   byeWeek: 7,  seasonFpts: 298.4, seasonStats: { gp: 13, passYds: 3248, passTd: 22, passInt: 9,  rushYds: 148, rushTd: 2 } },
  { id: "p6",  name: "Jordan Love",          pos: "QB",  nflTeam: "GB",  status: "Active", owned: false,                            byeWeek: 5,  seasonFpts: 274.2, seasonStats: { gp: 12, passYds: 2842, passTd: 20, passInt: 7,  rushYds: 124, rushTd: 2 } },
  { id: "p7",  name: "Sam Darnold",          pos: "QB",  nflTeam: "MIN", status: "Active", owned: false,                            byeWeek: 6,  seasonFpts: 248.6, seasonStats: { gp: 13, passYds: 2648, passTd: 18, passInt: 8,  rushYds: 98,  rushTd: 1 } },
  { id: "p8",  name: "Geno Smith",           pos: "QB",  nflTeam: "SEA", status: "Active", owned: false,                            byeWeek: 10, seasonFpts: 224.8, seasonStats: { gp: 13, passYds: 2512, passTd: 16, passInt: 6,  rushYds: 78,  rushTd: 1 } },
  { id: "p9",  name: "Derrick Henry",        pos: "RB",  nflTeam: "BAL", status: "Active", owned: true,  ownerTeam: "Team Gidley",  byeWeek: 14, seasonFpts: 298.4, seasonStats: { gp: 13, rushYds: 1512, rushTd: 14, rushAtt: 248, rec: 18, recYds: 112 } },
  { id: "p10", name: "Saquon Barkley",       pos: "RB",  nflTeam: "PHI", status: "Active", owned: true,  ownerTeam: "Team Sotka",   byeWeek: 5,  seasonFpts: 276.2, seasonStats: { gp: 13, rushYds: 1284, rushTd: 11, rushAtt: 218, rec: 34, recYds: 248, recTd: 2 } },
  { id: "p11", name: "Jahmyr Gibbs",         pos: "RB",  nflTeam: "DET", status: "Active", owned: true,  ownerTeam: "Team Gidley",  byeWeek: 5,  seasonFpts: 242.6, seasonStats: { gp: 13, rushYds: 924,  rushTd: 9,  rushAtt: 164, rec: 42, recYds: 348, recTd: 3 } },
  { id: "p12", name: "Christian McCaffrey",  pos: "RB",  nflTeam: "SF",  status: "BYE",    owned: true,  ownerTeam: "Team Sotka",   byeWeek: 9,  seasonFpts: 188.2, seasonStats: { gp: 10, rushYds: 748,  rushTd: 8,  rushAtt: 148, rec: 52, recYds: 384, recTd: 4 } },
  { id: "p13", name: "Bijan Robinson",       pos: "RB",  nflTeam: "ATL", status: "Active", owned: true,  ownerTeam: "Team Pattie",  byeWeek: 12, seasonFpts: 224.8, seasonStats: { gp: 13, rushYds: 1048, rushTd: 9,  rushAtt: 188, rec: 38, recYds: 248, recTd: 2 } },
  { id: "p14", name: "De'Von Achane",        pos: "RB",  nflTeam: "MIA", status: "Q",      owned: true,  ownerTeam: "Team Pattie",  byeWeek: 6,  seasonFpts: 198.4, seasonStats: { gp: 11, rushYds: 812,  rushTd: 7,  rushAtt: 142, rec: 44, recYds: 312, recTd: 3 }, injuryNote: "Questionable with ankle — limited practice Thursday" },
  { id: "p15", name: "Tony Pollard",         pos: "RB",  nflTeam: "TEN", status: "Active", owned: false,                            byeWeek: 5,  seasonFpts: 138.6, seasonStats: { gp: 13, rushYds: 624,  rushTd: 5,  rushAtt: 148, rec: 22, recYds: 148 } },
  { id: "p16", name: "Gus Edwards",          pos: "RB",  nflTeam: "LAC", status: "Active", owned: false,                            byeWeek: 5,  seasonFpts: 88.4,  seasonStats: { gp: 12, rushYds: 448,  rushTd: 4,  rushAtt: 112 } },
  { id: "p17", name: "Tyjae Spears",         pos: "RB",  nflTeam: "TEN", status: "Active", owned: false,                            byeWeek: 5,  seasonFpts: 82.4,  seasonStats: { gp: 12, rushYds: 348,  rushTd: 3,  rushAtt: 88,  rec: 18, recYds: 112 } },
  { id: "p18", name: "CeeDee Lamb",          pos: "WR",  nflTeam: "DAL", status: "Active", owned: true,  ownerTeam: "Team Sotka",   byeWeek: 7,  seasonFpts: 312.4, seasonStats: { gp: 13, rec: 94, recYds: 1348, recTd: 11 } },
  { id: "p19", name: "Tyreek Hill",          pos: "WR",  nflTeam: "MIA", status: "OUT",    owned: true,  ownerTeam: "Team Sotka",   byeWeek: 6,  seasonFpts: 218.6, seasonStats: { gp: 13, rec: 72, recYds: 1024, recTd: 6 },  injuryNote: "Ruled out Sunday with ankle injury — missed full practice" },
  { id: "p20", name: "Justin Jefferson",     pos: "WR",  nflTeam: "MIN", status: "Q",      owned: true,  ownerTeam: "Team Nelson",  byeWeek: 6,  seasonFpts: 248.6, seasonStats: { gp: 12, rec: 78, recYds: 1124, recTd: 8 },  injuryNote: "Questionable with hamstring — limited practice Wednesday" },
  { id: "p21", name: "Ja'Marr Chase",        pos: "WR",  nflTeam: "CIN", status: "Active", owned: true,  ownerTeam: "Team Gidley",  byeWeek: 7,  seasonFpts: 286.4, seasonStats: { gp: 13, rec: 88, recYds: 1248, recTd: 10 } },
  { id: "p22", name: "Amon-Ra St. Brown",    pos: "WR",  nflTeam: "DET", status: "Active", owned: true,  ownerTeam: "Team Nelson",  byeWeek: 5,  seasonFpts: 224.8, seasonStats: { gp: 13, rec: 84, recYds: 1012, recTd: 7 } },
  { id: "p23", name: "Jaylen Waddle",        pos: "WR",  nflTeam: "MIA", status: "Active", owned: false,                            byeWeek: 6,  seasonFpts: 162.4, seasonStats: { gp: 12, rec: 54, recYds: 724, recTd: 4 } },
  { id: "p24", name: "Elijah Moore",         pos: "WR",  nflTeam: "CLE", status: "Active", owned: false,                            byeWeek: 5,  seasonFpts: 96.2,  seasonStats: { gp: 13, rec: 38, recYds: 512, recTd: 3 } },
  { id: "p25", name: "Darnell Mooney",       pos: "WR",  nflTeam: "ATL", status: "Active", owned: false,                            byeWeek: 12, seasonFpts: 88.4,  seasonStats: { gp: 13, rec: 42, recYds: 488, recTd: 2 } },
  { id: "p26", name: "Travis Kelce",         pos: "TE",  nflTeam: "KC",  status: "Q",      owned: true,  ownerTeam: "Team Sotka",   byeWeek: 6,  seasonFpts: 198.4, seasonStats: { gp: 12, rec: 58, recYds: 648, recTd: 6 },  injuryNote: "Questionable with knee — limited practice Thursday" },
  { id: "p27", name: "Sam LaPorta",          pos: "TE",  nflTeam: "DET", status: "Q",      owned: true,  ownerTeam: "Team Gidley",  byeWeek: 5,  seasonFpts: 184.8, seasonStats: { gp: 13, rec: 58, recYds: 624, recTd: 7 },  injuryNote: "Questionable with shoulder — limited Wednesday" },
  { id: "p28", name: "Mark Andrews",         pos: "TE",  nflTeam: "BAL", status: "Active", owned: true,  ownerTeam: "Team Pattie",  byeWeek: 14, seasonFpts: 172.4, seasonStats: { gp: 13, rec: 52, recYds: 572, recTd: 6 } },
  { id: "p29", name: "Dallas Goedert",       pos: "TE",  nflTeam: "PHI", status: "Active", owned: true,  ownerTeam: "Team Nelson",  byeWeek: 5,  seasonFpts: 148.6, seasonStats: { gp: 13, rec: 48, recYds: 524, recTd: 5 } },
  { id: "p30", name: "Kyle Pitts",           pos: "TE",  nflTeam: "ATL", status: "Q",      owned: false,                            byeWeek: 12, seasonFpts: 124.8, seasonStats: { gp: 11, rec: 42, recYds: 548, recTd: 3 }, injuryNote: "Questionable with hamstring — limited all week" },
  { id: "p31", name: "Evan Engram",          pos: "TE",  nflTeam: "JAX", status: "Active", owned: false,                            byeWeek: 13, seasonFpts: 112.4, seasonStats: { gp: 13, rec: 44, recYds: 484, recTd: 3 } },
  { id: "p32", name: "Harrison Butker",      pos: "K",   nflTeam: "KC",  status: "Active", owned: true,  ownerTeam: "Team Gidley",  byeWeek: 6,  seasonFpts: 142.0, seasonStats: { gp: 13, fgm: 28, fga: 31, xpm: 42 } },
  { id: "p33", name: "Evan McPherson",       pos: "K",   nflTeam: "CIN", status: "Active", owned: false,                            byeWeek: 7,  seasonFpts: 112.0, seasonStats: { gp: 13, fgm: 22, fga: 26, xpm: 34 } },
  { id: "p34", name: "Brandon Aubrey",       pos: "K",   nflTeam: "DAL", status: "Active", owned: false,                            byeWeek: 7,  seasonFpts: 128.4, seasonStats: { gp: 13, fgm: 26, fga: 28, xpm: 38 } },
  { id: "p35", name: "San Francisco 49ers",  pos: "DST", nflTeam: "SF",  status: "Active", owned: true,  ownerTeam: "Team Gidley",  byeWeek: 9,  seasonFpts: 168.4, seasonStats: { gp: 13, sacks: 42, defInt: 14, defTd: 4, pa: 18 } },
  { id: "p36", name: "Pittsburgh Steelers",  pos: "DST", nflTeam: "PIT", status: "Active", owned: false,                            byeWeek: 9,  seasonFpts: 134.6, seasonStats: { gp: 13, sacks: 34, defInt: 10, defTd: 2, pa: 22 } },
  { id: "p37", name: "Dallas Cowboys",       pos: "DST", nflTeam: "DAL", status: "Active", owned: true,  ownerTeam: "Team Sotka",   byeWeek: 7,  seasonFpts: 148.2, seasonStats: { gp: 13, sacks: 38, defInt: 12, defTd: 3, pa: 20 } },
];

// ── Stat chip builder ─────────────────────────────────────────────────────────
function buildStatChips(p: NFLPlayer): { label: string; value: string }[] {
  const s = p.seasonStats;
  const chips: { label: string; value: string }[] = [];
  if (p.pos === "QB") {
    if (s.passYds) chips.push({ label: "PYDS", value: s.passYds.toLocaleString() });
    if (s.passTd)  chips.push({ label: "PTD",  value: String(s.passTd) });
    if (s.passInt) chips.push({ label: "INT",  value: String(s.passInt) });
    if (s.rushYds) chips.push({ label: "RYDS", value: String(s.rushYds) });
    if (s.rushTd)  chips.push({ label: "RTD",  value: String(s.rushTd) });
  } else if (p.pos === "RB") {
    if (s.rushYds) chips.push({ label: "RYDS", value: s.rushYds.toLocaleString() });
    if (s.rushTd)  chips.push({ label: "RTD",  value: String(s.rushTd) });
    if (s.rec)     chips.push({ label: "REC",  value: String(s.rec) });
    if (s.recYds)  chips.push({ label: "RCYDS",value: String(s.recYds) });
    if (s.recTd)   chips.push({ label: "RCTD", value: String(s.recTd) });
  } else if (p.pos === "WR" || p.pos === "TE") {
    if (s.rec)     chips.push({ label: "REC",  value: String(s.rec) });
    if (s.recYds)  chips.push({ label: "YDS",  value: s.recYds!.toLocaleString() });
    if (s.recTd)   chips.push({ label: "TD",   value: String(s.recTd) });
  } else if (p.pos === "K") {
    if (s.fgm !== undefined && s.fga !== undefined)
      chips.push({ label: "FG", value: `${s.fgm}/${s.fga}` });
    if (s.xpm) chips.push({ label: "XP", value: String(s.xpm) });
  } else if (p.pos === "DST") {
    if (s.sacks)  chips.push({ label: "SACK", value: String(s.sacks) });
    if (s.defInt) chips.push({ label: "INT",  value: String(s.defInt) });
    if (s.defTd)  chips.push({ label: "TD",   value: String(s.defTd) });
    if (s.pa)     chips.push({ label: "PA/G", value: String(s.pa) });
  }
  return chips;
}

const POS_COLORS: Record<string, string> = {
  QB: "oklch(0.42 0.18 260)", RB: "oklch(0.38 0.15 150)",
  WR: "oklch(0.42 0.18 220)", TE: "oklch(0.55 0.16 85)",
  K:  "oklch(0.50 0.04 150)", DST:"oklch(0.45 0.18 25)",
};
const STATUS_COLORS: Record<string, string> = {
  Active: "oklch(0.42 0.15 150)", Q: "oklch(0.65 0.14 85)",
  D: "oklch(0.55 0.22 25)", OUT: "oklch(0.5 0.22 25)", BYE: "oklch(0.50 0.02 150)",
};

// ── News data ─────────────────────────────────────────────────────────────────
const NEWS = [
  { player: "Justin Jefferson", team: "MIN", pos: "WR", status: "Q",      headline: "Questionable with hamstring — limited practice Wednesday", time: "2h ago",  source: "ESPN" },
  { player: "Tyreek Hill",      team: "MIA", pos: "WR", status: "OUT",    headline: "Ruled out Sunday with ankle injury, missed full practice",  time: "3h ago",  source: "Rotowire" },
  { player: "Derrick Henry",    team: "BAL", pos: "RB", status: "Active", headline: "Full practice participant, no injury designation",           time: "4h ago",  source: "ESPN" },
  { player: "Travis Kelce",     team: "KC",  pos: "TE", status: "Q",      headline: "Questionable with knee — limited practice Thursday",        time: "5h ago",  source: "ESPN" },
  { player: "CeeDee Lamb",      team: "DAL", pos: "WR", status: "Active", headline: "No injury designation, full practice all week",             time: "6h ago",  source: "Rotowire" },
  { player: "Saquon Barkley",   team: "PHI", pos: "RB", status: "Active", headline: "Full practice, expected to play full workload Sunday",      time: "8h ago",  source: "ESPN" },
  { player: "Sam LaPorta",      team: "DET", pos: "TE", status: "Q",      headline: "Questionable with shoulder, limited Wednesday",             time: "10h ago", source: "Rotowire" },
  { player: "Josh Allen",       team: "BUF", pos: "QB", status: "Active", headline: "No injury concerns, full practice participant all week",    time: "12h ago", source: "ESPN" },
];

// ── Player Browser ────────────────────────────────────────────────────────────
function PlayerBrowser() {
  const [search, setSearch]           = useState("");
  const [posFilter, setPosFilter]     = useState("ALL");
  const [ownFilter, setOwnFilter]     = useState("ALL");
  const [sortBy, setSortBy]           = useState<"fpts"|"fpg"|"name">("fpts");
  const [watchlist, setWatchlist]     = useState<Set<string>>(new Set());
  const [watchOnly, setWatchOnly]     = useState(false);
  // bidPlayerId: which FA row has the bid panel open
  const [bidPlayerId, setBidPlayerId] = useState<string | null>(null);
  const [bidAmount, setBidAmount]     = useState("");
  // injuryExpanded: which rows have the injury note expanded
  const [injuryExpanded, setInjuryExpanded] = useState<Set<string>>(new Set());
  // submitted bids (persisted in local state for demo)
  const [submittedBids, setSubmittedBids] = useState<Record<string, number>>({});

  const toggleWatch = (id: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleInjury = (id: string) => {
    setInjuryExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openBid = (id: string) => {
    setBidPlayerId(id);
    setBidAmount("");
  };

  const cancelBid = () => {
    setBidPlayerId(null);
    setBidAmount("");
  };

  const submitBid = (player: NFLPlayer) => {
    const amt = parseInt(bidAmount, 10);
    if (isNaN(amt) || amt < 0) {
      toast.error("Enter a valid FAAB amount (0 or more)");
      return;
    }
    if (amt > MY_FAAB) {
      toast.error(`Bid exceeds your FAAB balance ($${MY_FAAB})`);
      return;
    }
    setSubmittedBids(prev => ({ ...prev, [player.id]: amt }));
    setBidPlayerId(null);
    setBidAmount("");
    toast.success(`Waiver claim submitted: ${player.name} — $${amt} FAAB`);
  };

  const filtered = PLAYERS
    .filter(p => {
      const q = search.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || p.nflTeam.toLowerCase().includes(q);
      const matchPos  = posFilter === "ALL" || p.pos === posFilter;
      const matchOwn  = ownFilter === "ALL" || (ownFilter === "FA" && !p.owned) || (ownFilter === "OWNED" && p.owned);
      const matchWatch = !watchOnly || watchlist.has(p.id);
      return matchSearch && matchPos && matchOwn && matchWatch;
    })
    .sort((a, b) => {
      if (sortBy === "fpts") return b.seasonFpts - a.seasonFpts;
      if (sortBy === "fpg") {
        const fpgA = a.seasonStats.gp > 0 ? a.seasonFpts / a.seasonStats.gp : 0;
        const fpgB = b.seasonStats.gp > 0 ? b.seasonFpts / b.seasonStats.gp : 0;
        return fpgB - fpgA;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div>
      {/* Filter bar */}
      <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
        <div style={{ padding: "0.875rem 1.25rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" as const, alignItems: "center" }}>
          <div style={{ position: "relative" as const, flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search players or teams…"
              style={{ width: "100%", padding: "0.5rem 0.5rem 0.5rem 2rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", outline: "none", boxSizing: "border-box" as const }}
            />
          </div>
          <select value={posFilter} onChange={e => setPosFilter(e.target.value)} style={{ padding: "0.5rem 0.75rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", background: "white", cursor: "pointer", outline: "none" }}>
            <option value="ALL">All Positions</option>
            {["QB","RB","WR","TE","K","DST"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={ownFilter} onChange={e => setOwnFilter(e.target.value)} style={{ padding: "0.5rem 0.75rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", background: "white", cursor: "pointer", outline: "none" }}>
            <option value="ALL">All Players</option>
            <option value="FA">Free Agents</option>
            <option value="OWNED">Rostered</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as "fpts"|"fpg"|"name")} style={{ padding: "0.5rem 0.75rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", background: "white", cursor: "pointer", outline: "none" }}>
            <option value="fpts">Sort: Season FPTS</option>
            <option value="fpg">Sort: FP/G</option>
            <option value="name">Sort: Name</option>
          </select>
          {/* Watchlist toggle */}
          <button
            onClick={() => setWatchOnly(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              padding: "0.5rem 0.875rem", borderRadius: 8, cursor: "pointer",
              fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 700,
              letterSpacing: "0.05em", border: "1.5px solid",
              background: watchOnly ? "oklch(0.55 0.16 85)" : "white",
              color:      watchOnly ? "white" : "oklch(0.55 0.16 85)",
              borderColor: "oklch(0.55 0.16 85)",
              transition: "all 0.15s",
            }}
          >
            <Star size={13} fill={watchOnly ? "white" : "none"} />
            {watchOnly ? "Watchlist" : "Watchlist"}
          </button>
        </div>
        {/* FAAB balance */}
        <div style={{ padding: "0 1.25rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <DollarSign size={13} color="oklch(0.38 0.14 85)" />
          <span style={{ fontSize: "0.75rem", color: "oklch(0.45 0.04 150)" }}>
            Your FAAB balance: <strong style={{ color: "oklch(0.28 0.09 150)" }}>${MY_FAAB}</strong>
          </span>
          {watchlist.size > 0 && (
            <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "oklch(0.55 0.16 85)", fontWeight: 700 }}>
              ★ {watchlist.size} watched
            </span>
          )}
        </div>
      </div>

      {/* Player list */}
      <div className="wrc-card">
        <div className="wrc-card-gold-stripe" />
        <div className="wrc-card-header">
          <Users size={14} />
          Player Pool
          <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "oklch(0.6 0.04 150)" }}>
            {filtered.length} players · Week {CURRENT_WEEK}
          </span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: "2.5rem", textAlign: "center" as const, color: "oklch(0.6 0.04 150)" }}>No players match your filters</div>
        )}

        {filtered.map((p, i) => {
          const gp  = p.seasonStats.gp;
          const fpg = gp > 0 ? (p.seasonFpts / gp).toFixed(1) : "—";
          const chips = buildStatChips(p);
          const byeConflict = p.byeWeek === CURRENT_WEEK;
          const isWatched   = watchlist.has(p.id);
          const isBidOpen   = bidPlayerId === p.id;
          const isInjuryOpen = injuryExpanded.has(p.id);
          const hasBid      = submittedBids[p.id] !== undefined;
          const hasInjury   = !!p.injuryNote && p.status !== "Active";

          return (
            <div key={p.id} style={{
              borderBottom: i < filtered.length - 1 ? "1px solid oklch(0.93 0.005 150)" : "none",
              background: byeConflict ? "oklch(0.98 0.03 25)" : "white",
            }}>
              {/* Main row */}
              <div style={{ display: "flex", gap: "0.6rem", padding: "0.75rem 1rem", alignItems: "flex-start" }}>

                {/* Star / watchlist */}
                <button
                  onClick={() => toggleWatch(p.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", flexShrink: 0, marginTop: 1 }}
                  title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                >
                  <Star
                    size={16}
                    fill={isWatched ? "oklch(0.55 0.16 85)" : "none"}
                    color={isWatched ? "oklch(0.55 0.16 85)" : "oklch(0.75 0.04 150)"}
                    style={{ transition: "all 0.15s" }}
                  />
                </button>

                {/* Pos badge */}
                <div style={{
                  width: 42, textAlign: "center" as const, flexShrink: 0, marginTop: 2,
                  fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", fontWeight: 700,
                  color: "white", background: POS_COLORS[p.pos] || "oklch(0.5 0.04 150)",
                  borderRadius: 4, padding: "2px 0",
                }}>{p.pos}</div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" as const }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)" }}>{p.name}</span>
                    <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>{p.nflTeam}</span>
                    {p.status !== "Active" && (
                      <span style={{
                        fontSize: "0.62rem", fontWeight: 700, fontFamily: "Oswald, sans-serif",
                        padding: "1px 5px", borderRadius: 3,
                        background: `${STATUS_COLORS[p.status] || "oklch(0.5 0.04 150)"}18`,
                        color: STATUS_COLORS[p.status] || "oklch(0.5 0.04 150)",
                      }}>{p.status}</span>
                    )}
                    {p.owned ? (
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", padding: "1px 5px", borderRadius: 3, background: "oklch(0.92 0.04 260)", color: "oklch(0.35 0.14 260)" }}>
                        {p.ownerTeam}
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", padding: "1px 5px", borderRadius: 3, background: "oklch(0.94 0.06 150)", color: "oklch(0.32 0.12 150)" }}>
                        FREE AGENT
                      </span>
                    )}
                    {hasBid && (
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", padding: "1px 5px", borderRadius: 3, background: "oklch(0.92 0.08 85)", color: "oklch(0.38 0.16 85)", border: "1px solid oklch(0.82 0.10 85)" }}>
                        BID ${submittedBids[p.id]}
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: "0.3rem", marginTop: "0.35rem" }}>
                    <span style={{ fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "oklch(0.92 0.06 150)", color: "oklch(0.28 0.09 150)", border: "1px solid oklch(0.84 0.08 150)", whiteSpace: "nowrap" as const }}>
                      {p.seasonFpts.toFixed(1)} FPTS
                    </span>
                    <span style={{ fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "oklch(0.94 0.04 85)", color: "oklch(0.38 0.14 85)", border: "1px solid oklch(0.86 0.07 85)", whiteSpace: "nowrap" as const }}>
                      {fpg}/G
                    </span>
                    <span style={{
                      fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", fontWeight: 700,
                      padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" as const,
                      background: byeConflict ? "oklch(0.92 0.12 25)" : "oklch(0.93 0.005 150)",
                      color:      byeConflict ? "oklch(0.45 0.20 25)" : "oklch(0.52 0.02 150)",
                      border:     byeConflict ? "1px solid oklch(0.82 0.14 25)" : "1px solid oklch(0.85 0.01 150)",
                    }}>
                      {byeConflict ? `⚠ BYE ${p.byeWeek}` : `BYE ${p.byeWeek}`}
                    </span>
                    {chips.map((c, ci) => (
                      <span key={ci} style={{ fontSize: "0.58rem", fontFamily: "Oswald, sans-serif", fontWeight: 600, padding: "1px 4px", borderRadius: 3, background: "oklch(0.95 0.005 150)", color: "oklch(0.42 0.04 150)", border: "1px solid oklch(0.88 0.01 150)", whiteSpace: "nowrap" as const }}>
                        {c.label} {c.value}
                      </span>
                    ))}
                  </div>

                  {/* Injury toggle — only shown if player has an injury note */}
                  {hasInjury && (
                    <button
                      onClick={() => toggleInjury(p.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.3rem",
                        marginTop: "0.35rem", background: "none", border: "none",
                        cursor: "pointer", padding: 0,
                        fontSize: "0.68rem", color: STATUS_COLORS[p.status] || "oklch(0.5 0.04 150)",
                        fontWeight: 600,
                      }}
                    >
                      <AlertTriangle size={11} />
                      {isInjuryOpen ? "Hide injury note" : "Show injury note"}
                      {isInjuryOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  )}

                  {/* Injury note expanded */}
                  {hasInjury && isInjuryOpen && (
                    <div style={{
                      marginTop: "0.35rem", padding: "0.5rem 0.75rem",
                      background: `${STATUS_COLORS[p.status]}10`,
                      border: `1px solid ${STATUS_COLORS[p.status]}30`,
                      borderRadius: 6, fontSize: "0.8rem",
                      color: "oklch(0.35 0.04 150)", lineHeight: 1.5,
                    }}>
                      {p.injuryNote}
                    </div>
                  )}
                </div>

                {/* Right side: FPTS + action */}
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: "0.35rem", flexShrink: 0 }}>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "oklch(0.22 0.08 150)", lineHeight: 1 }}>{p.seasonFpts.toFixed(1)}</div>
                    <div style={{ fontSize: "0.6rem", color: "oklch(0.6 0.04 150)", marginTop: 2 }}>{fpg}/G</div>
                  </div>
                  {/* Bid button — only for free agents */}
                  {!p.owned && !hasBid && (
                    <button
                      onClick={() => isBidOpen ? cancelBid() : openBid(p.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.3rem",
                        padding: "3px 10px", borderRadius: 5, cursor: "pointer",
                        fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700,
                        letterSpacing: "0.04em",
                        background: isBidOpen ? "oklch(0.95 0.02 150)" : "oklch(0.28 0.09 150)",
                        color: isBidOpen ? "oklch(0.45 0.04 150)" : "white",
                        border: isBidOpen ? "1px solid oklch(0.82 0.02 150)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <DollarSign size={11} />
                      {isBidOpen ? "Cancel" : "Bid"}
                    </button>
                  )}
                  {hasBid && (
                    <button
                      onClick={() => { setSubmittedBids(prev => { const n = {...prev}; delete n[p.id]; return n; }); }}
                      style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, background: "oklch(0.95 0.02 150)", color: "oklch(0.5 0.04 150)", border: "1px solid oklch(0.82 0.02 150)" }}
                    >
                      <X size={11} /> Cancel Bid
                    </button>
                  )}
                </div>
              </div>

              {/* FAAB Bid panel */}
              {isBidOpen && (
                <div style={{
                  margin: "0 1rem 0.75rem",
                  padding: "0.75rem 1rem",
                  background: "oklch(0.97 0.02 150)",
                  border: "1.5px solid oklch(0.88 0.04 150)",
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: "0.72rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.06em", color: "oklch(0.38 0.08 150)", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>
                    FAAB Waiver Claim — {p.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "white", border: "1.5px solid oklch(0.84 0.04 150)", borderRadius: 6, padding: "0.3rem 0.6rem" }}>
                      <DollarSign size={13} color="oklch(0.38 0.14 85)" />
                      <input
                        type="number" min={0} max={MY_FAAB}
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        placeholder="0"
                        style={{ width: 70, border: "none", outline: "none", fontSize: "0.9rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "oklch(0.22 0.08 150)" }}
                        onKeyDown={e => e.key === "Enter" && submitBid(p)}
                        autoFocus
                      />
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "oklch(0.55 0.04 150)" }}>
                      Balance: <strong>${MY_FAAB}</strong> · Max bid: <strong>${MY_FAAB}</strong>
                    </span>
                    <button
                      onClick={() => submitBid(p)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.3rem",
                        padding: "0.4rem 1rem", borderRadius: 6, cursor: "pointer",
                        fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 700,
                        background: "oklch(0.38 0.15 150)", color: "white", border: "none",
                        transition: "background 0.15s",
                      }}
                    >
                      <Check size={13} /> Submit Claim
                    </button>
                    <button
                      onClick={cancelBid}
                      style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.4rem 0.75rem", borderRadius: 6, cursor: "pointer", fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 700, background: "white", color: "oklch(0.5 0.04 150)", border: "1px solid oklch(0.82 0.02 150)" }}
                    >
                      <X size={13} /> Cancel
                    </button>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "oklch(0.6 0.04 150)", marginTop: "0.4rem" }}>
                    Waiver claims process Tuesday morning. Highest bid wins. $0 bid = priority waiver.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── News Feed ─────────────────────────────────────────────────────────────────
function NewsFeed() {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = NEWS.filter(n => {
    const matchSearch = n.player.toLowerCase().includes(search.toLowerCase()) || n.team.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || n.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="wrc-card" style={{ marginBottom: "1.25rem" }}>
        <div style={{ padding: "0.875rem 1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" as const, alignItems: "center" }}>
          <div style={{ position: "relative" as const, flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "oklch(0.55 0.04 150)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…" style={{ width: "100%", padding: "0.5rem 0.5rem 0.5rem 2rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", outline: "none", boxSizing: "border-box" as const }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "0.5rem 0.75rem", border: "1.5px solid oklch(0.88 0.01 150)", borderRadius: 8, fontSize: "0.875rem", background: "white", cursor: "pointer", outline: "none" }}>
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Q">Questionable</option>
            <option value="OUT">Out</option>
          </select>
        </div>
      </div>
      <div className="wrc-card">
        <div className="wrc-card-gold-stripe" />
        <div className="wrc-card-header"><Activity size={14} /> Latest Updates</div>
        <div>
          {filtered.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "0.875rem", padding: "0.875rem 1.25rem", borderBottom: "1px solid oklch(0.92 0.005 150)", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                {item.status !== "Active" ? <AlertTriangle size={16} color={STATUS_COLORS[item.status]} /> : <Activity size={16} color="oklch(0.42 0.15 150)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" as const, marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "oklch(0.18 0.05 150)" }}>{item.player}</span>
                  <span style={{ fontSize: "0.72rem", color: "oklch(0.55 0.04 150)" }}>{item.pos} · {item.team}</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: STATUS_COLORS[item.status] || "oklch(0.5 0.04 150)", background: `${STATUS_COLORS[item.status]}18`, borderRadius: 4, padding: "1px 6px" }}>{item.status}</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "oklch(0.35 0.04 150)", lineHeight: 1.5 }}>{item.headline}</p>
                <div style={{ fontSize: "0.72rem", color: "oklch(0.6 0.04 150)", marginTop: "0.25rem" }}>{item.source} · {item.time}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: "2rem", textAlign: "center" as const, color: "oklch(0.6 0.04 150)" }}>No news found</div>}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PlayerNews() {
  const { franchise } = useAuth();
  const [tab, setTab] = useState<"players"|"news">("players");

  const tabStyle = (active: boolean) => ({
    padding: "0.5rem 1.25rem",
    fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase" as const,
    border: "none", cursor: "pointer",
    borderRadius: "6px 6px 0 0",
    background: active ? "white" : "transparent",
    color: active ? "oklch(0.22 0.08 150)" : "oklch(0.6 0.04 150)",
    borderBottom: active ? "2px solid oklch(0.55 0.16 85)" : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div className="bg-turf bg-overlay" style={{ minHeight: "100vh" }}>
      <Navigation showTicker={false} teamName={franchise?.team_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div className="wrc-page-title" style={{ padding: "1rem 0 1rem" }}>
          <h1>Players</h1>
          <p>Browse all players, free agents, and injury news — Week {CURRENT_WEEK}</p>
        </div>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid oklch(0.88 0.01 150)", marginBottom: "1.25rem" }}>
          <button style={tabStyle(tab === "players")} onClick={() => setTab("players")}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Users size={13} /> Player Browser</span>
          </button>
          <button style={tabStyle(tab === "news")} onClick={() => setTab("news")}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Newspaper size={13} /> Injury News</span>
          </button>
        </div>
        {tab === "players" ? <PlayerBrowser /> : <NewsFeed />}
      </div>
    </div>
  );
}
