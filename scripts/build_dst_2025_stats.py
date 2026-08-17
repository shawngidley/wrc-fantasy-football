"""Derive WRC D/ST season totals from authoritative completed 2025 sources.

The script streams nflverse play-by-play for sacks, safeties, and return touchdowns.
It pairs that data with the completed PFR team-defense table for official takeaways,
defensive interceptions, opponent fumbles lost, and points allowed. Tank01's
``fumblesRecovered`` field is deliberately not used because it includes recoveries of
the team's own offensive fumbles and therefore is not a D/ST takeover total.
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import sys
from collections import defaultdict
from urllib.request import urlopen

URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.csv.gz"
PFR_MARKDOWN = "/home/ubuntu/upload/www.pro-football-reference.com_years_2025_opp.htm_1786986920271.md"

PFR_TEAM_TO_ABV = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
    "Los Angeles Rams": "LA", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
    "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
    "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
}


def flag(value: str | None) -> bool:
    try:
        return float(value or 0) > 0
    except ValueError:
        return False


stats = defaultdict(lambda: {"sacks": 0, "safeties": 0, "takeaways": 0, "dstTD": 0})

with urlopen(URL, timeout=90) as response:
    with gzip.GzipFile(fileobj=response) as compressed:
        rows = csv.DictReader(io.TextIOWrapper(compressed, encoding="utf-8"))
        for row in rows:
            if row.get("season_type") != "REG":
                continue

            defense = row.get("defteam")
            if not defense:
                continue

            if flag(row.get("sack")):
                stats[defense]["sacks"] += 1
            if flag(row.get("safety")):
                stats[defense]["safeties"] += 1

            # nflverse credits defensive, punt-return, kickoff-return, and fumble-return
            # scores to td_team on return_touchdown plays.
            if flag(row.get("return_touchdown")) and row.get("td_team"):
                stats[row["td_team"]]["dstTD"] += 1

pfr_stats = {}
for line in open(PFR_MARKDOWN, encoding="utf-8"):
    if line.startswith("## Team Advanced Defense"):
        break
    if not line.startswith("|"):
        continue
    columns = [column.strip().replace("\\.", ".") for column in line.strip().strip("|").split("|")]
    if not columns or not columns[0].isdigit() or len(columns) < 15:
        continue
    team = columns[1]
    abbreviation = PFR_TEAM_TO_ABV.get(team)
    if not abbreviation:
        continue
    # PFR 2025 Team Defense: PA at 3, official takeaways at 7, opponent fumbles
    # lost at 8, and defensive interceptions at 14.
    pfr_stats[abbreviation] = {
        "ptsAgainst": int(columns[3]),
        "takeaways": int(columns[7]),
        "fumblesRecovered": int(columns[8]),
        "defInt": int(columns[14]),
    }

if len(pfr_stats) != 32:
    raise RuntimeError(f"Expected 32 PFR teams, found {len(pfr_stats)}")

combined = {}
for abbreviation, official in sorted(pfr_stats.items()):
    play_by_play = stats.get(abbreviation, {})
    combined[abbreviation] = {
        "games": 17,
        "sacks": play_by_play.get("sacks", 0),
        "safeties": play_by_play.get("safeties", 0),
        "takeaways": official["takeaways"],
        "defInt": official["defInt"],
        "fumblesRecovered": official["fumblesRecovered"],
        "dstTD": play_by_play.get("dstTD", 0),
        "ptsAgainst": official["ptsAgainst"],
    }

print(json.dumps(combined, indent=2))
