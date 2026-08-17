"""Build exact WRC 2025 regular-season kicker totals from nflverse play-by-play.

Rules: +0.1 per made FG yard, +1 bonus for 60-64, +2 bonus for 65+,
+1 made XP, -2 missed XP, -2 missed FGs from 1-49 yards.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import os
import urllib.request
from collections import defaultdict

PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.csv.gz"
PLAYERS_URL = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"
PBP_PATH = "/tmp/nflverse_pbp_2025.csv.gz"
PLAYERS_PATH = "/tmp/nflverse_players.csv"


def ensure(url: str, path: str) -> None:
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)


def number(value: str | None) -> float:
    try:
        return float(value or 0)
    except ValueError:
        return 0


def main() -> None:
    ensure(PBP_URL, PBP_PATH)
    ensure(PLAYERS_URL, PLAYERS_PATH)

    names: dict[str, str] = {}
    with open(PLAYERS_PATH, newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            if row.get("gsis_id") and row.get("display_name"):
                names[row["gsis_id"]] = row["display_name"]

    totals: dict[str, dict[str, float | set[str]]] = defaultdict(lambda: {"fgm": 0, "fga": 0, "xpm": 0, "xpa": 0, "fpts": 0, "games": set()})
    with gzip.open(PBP_PATH, "rt", encoding="utf-8") as raw:
        for row in csv.DictReader(raw):
            if row.get("season_type") != "REG":
                continue
            kicker_id = row.get("kicker_player_id") or ""
            if not kicker_id:
                continue
            output = totals[kicker_id]
            if row.get("game_id"):
                output["games"].add(row["game_id"])
            fg_result = row.get("field_goal_result") or ""
            xp_result = row.get("extra_point_result") or ""
            distance = number(row.get("kick_distance"))
            if fg_result:
                output["fga"] += 1
                if fg_result == "made":
                    output["fgm"] += 1
                    output["fpts"] += distance * 0.1
                    if 60 <= distance <= 64:
                        output["fpts"] += 1
                    elif distance >= 65:
                        output["fpts"] += 2
                elif distance <= 49:
                    output["fpts"] -= 2
            if xp_result:
                output["xpa"] += 1
                if xp_result == "good":
                    output["xpm"] += 1
                    output["fpts"] += 1
                else:
                    output["fpts"] -= 2

    output = {
        names.get(kicker_id, kicker_id): {
            "games": len(stats["games"]), "fgm": int(stats["fgm"]), "fga": int(stats["fga"]),
            "xpm": int(stats["xpm"]), "xpa": int(stats["xpa"]),
            "fpts": round(stats["fpts"], 1),
        }
        for kicker_id, stats in totals.items()
        if names.get(kicker_id)
    }
    print(json.dumps(dict(sorted(output.items())), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
