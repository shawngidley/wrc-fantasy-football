"""Derive completed 2025 offensive player totals for the WRC Free Agents pool.

This is an offline audit/generation utility. It consumes the public nflverse regular-
season play-by-play release and writes a TypeScript-ready lookup to /tmp so no
RapidAPI player query is needed to validate season FPTS.
"""

from __future__ import annotations

import csv
import gzip
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PBP = Path("/tmp/play_by_play_2025.csv.gz")
ROSTER = Path("/tmp/roster_2025.csv")
PLAYERS = ROOT / "shared/currentDraftPlayerUniverse2026.ts"
OUTPUT = Path("/tmp/free_agents_2025_offense.json")


def number(value: str | None) -> int:
    try:
        return int(float(value or 0))
    except ValueError:
        return 0


def player_pool() -> dict[str, dict[str, str]]:
    # currentDraftPlayerUniverse2026.ts is the actual, current, comprehensive
    # player list the rest of the app uses (queue, draft board, protections).
    # This used to read from client/src/lib/nflPlayers2026.ts, a smaller,
    # stale list that was missing players entirely (e.g. Luther Burden III),
    # so anyone missing from it silently got no season-stats entry at all --
    # not even a zero-stat placeholder.
    text = PLAYERS.read_text(encoding="utf-8")
    match = re.search(r"String\.raw`\n(\[.*\])\n`", text, re.DOTALL)
    if not match:
        raise RuntimeError("Could not locate the player universe JSON array in currentDraftPlayerUniverse2026.ts")
    players = json.loads(match.group(1))
    return {
        p["name"]: {"pos": p["pos"], "team": p["nflTeam"]}
        for p in players
        if p["pos"] in ("QB", "RB", "WR", "TE")
    }


def canonical_name(name: str) -> str:
    return re.sub(r"\s+(Jr\.|Sr\.|II|III|IV)$", "", name.strip(), flags=re.IGNORECASE).lower()


def roster_ids(pool: dict[str, dict[str, str]]) -> dict[str, str]:
    pool_by_canonical = {canonical_name(name): name for name in pool}
    with ROSTER.open("r", encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle)
        return {
            row["gsis_id"]: pool_by_canonical[canonical_name(row["full_name"])]
            for row in rows
            if row.get("gsis_id") and canonical_name(row.get("full_name", "")) in pool_by_canonical
        }


def main() -> None:
    pool = player_pool()
    ids = roster_ids(pool)
    by_name: dict[str, dict[str, int | set[str]]] = defaultdict(lambda: {
        "passYds": 0, "passTd": 0, "passInt": 0,
        "rushAtt": 0, "rushYds": 0, "rushTd": 0,
        "rec": 0, "recYds": 0, "recTd": 0,
        "fumblesLost": 0, "returnTd": 0, "games": set(),
    })

    with gzip.open(PBP, "rt", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("season") != "2025" or row.get("season_type") != "REG":
                continue
            game_id = row.get("game_id", "")

            passer = ids.get(row.get("passer_player_id", ""), "")
            if passer:
                stat = by_name[passer]
                stat["passYds"] += number(row.get("passing_yards"))
                stat["passTd"] += number(row.get("pass_touchdown"))
                stat["passInt"] += number(row.get("interception"))
                stat["games"].add(game_id)

            rusher = ids.get(row.get("rusher_player_id", ""), "")
            if rusher:
                stat = by_name[rusher]
                stat["rushAtt"] += number(row.get("rush_attempt"))
                stat["rushYds"] += number(row.get("rushing_yards"))
                stat["rushTd"] += number(row.get("rush_touchdown"))
                stat["games"].add(game_id)

            receiver = ids.get(row.get("receiver_player_id", ""), "")
            if receiver:
                stat = by_name[receiver]
                stat["rec"] += number(row.get("complete_pass"))
                stat["recYds"] += number(row.get("receiving_yards"))
                stat["recTd"] += number(row.get("pass_touchdown"))
                stat["games"].add(game_id)

            fumbler = ids.get(row.get("fumbled_1_player_id", ""), "")
            if fumbler and number(row.get("fumble_lost")):
                stat = by_name[fumbler]
                stat["fumblesLost"] += 1
                stat["games"].add(game_id)

            scorer = ids.get(row.get("fantasy_player_id", ""), "")
            if scorer and number(row.get("return_touchdown")):
                stat = by_name[scorer]
                stat["returnTd"] += 1
                stat["games"].add(game_id)

    output: dict[str, dict[str, int | str]] = {}
    for name, metadata in pool.items():
        stat = by_name.get(name, {
            "passYds": 0, "passTd": 0, "passInt": 0,
            "rushAtt": 0, "rushYds": 0, "rushTd": 0,
            "rec": 0, "recYds": 0, "recTd": 0,
            "fumblesLost": 0, "returnTd": 0, "games": set(),
        })
        output[name] = {
            "pos": metadata["pos"],
            "passYds": stat["passYds"], "passTd": stat["passTd"], "passInt": stat["passInt"],
            "rushAtt": stat["rushAtt"], "rushYds": stat["rushYds"], "rushTd": stat["rushTd"],
            "rec": stat["rec"], "recYds": stat["recYds"], "recTd": stat["recTd"],
            "fumblesLost": stat["fumblesLost"], "returnTd": stat["returnTd"],
            "games": len(stat["games"]),
        }

    OUTPUT.write_text(json.dumps(output, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Wrote {len(output)} completed-season player records to {OUTPUT}")


if __name__ == "__main__":
    main()
