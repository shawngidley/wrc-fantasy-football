"""Independently reconcile representative 2025 Tank01 player lines to WRC FPTS.

This deliberately mirrors the published WRC rules, not the TypeScript implementation,
and writes a compact evidence record for the Lineup scoring audit.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

BASE_URL = "https://3000-iyov1zd3vebeu05kikibg-1e914ae3.us2.manus.computer/api/tank01/getNFLPlayerInfo"
PLAYERS = [("Jared Goff", "QB"), ("Aaron Jones", "RB"), ("Justin Jefferson", "WR"), ("Darren Waller", "TE")]


def number(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def wrc_points(stats: dict[str, object], pos: str) -> float:
    passing = stats.get("Passing", {}) or {}
    rushing = stats.get("Rushing", {}) or {}
    receiving = stats.get("Receiving", {}) or {}
    defense = stats.get("Defense", {}) or {}
    fumbles = stats.get("Fumbles", {}) or {}
    pts = (
        number(passing.get("passYds")) * 0.04 + number(passing.get("passTD")) * 4 - number(passing.get("int")) * 3 + number(passing.get("passingTwoPointConversion"))
        + number(rushing.get("rushYds")) * 0.1 + number(rushing.get("rushTD")) * 6 + number(rushing.get("rushingTwoPointConversion")) * 2
        + number(receiving.get("recYds")) * 0.1 + number(receiving.get("recTD")) * 6 + number(receiving.get("receptions")) * (1.5 if pos == "TE" else 1)
        + number(receiving.get("receivingTwoPointConversion")) * 2 - number(fumbles.get("fumblesLost", defense.get("fumblesLost"))) * 3
        + number(defense.get("returnTD")) * 6
    )
    return round(pts, 1)


def main() -> None:
    results = []
    for name, position in PLAYERS:
        query = urllib.parse.urlencode({"playerName": name, "getStats": "true"})
        with urllib.request.urlopen(f"{BASE_URL}?{query}", timeout=20) as response:
            payload = json.load(response)
        player = payload["body"][0]
        stats = player.get("stats", {})
        results.append({
            "name": name,
            "position": position,
            "games": number(stats.get("gamesPlayed")),
            "fpts": wrc_points(stats, position),
            "fpg": round(wrc_points(stats, position) / number(stats.get("gamesPlayed")), 1),
            "raw": {
                "passing": stats.get("Passing", {}), "rushing": stats.get("Rushing", {}),
                "receiving": stats.get("Receiving", {}), "fumbles": stats.get("Fumbles", stats.get("Defense", {})),
            },
        })
    print(json.dumps(results, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
