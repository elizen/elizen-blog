#!/usr/bin/env python3
"""Replace the retired poster mirror URLs in doumark CSV files.

doumark already reads the official Frodo API, but its CSV formatter replaces
the returned cover URL with dou.img.lithub.cc.  That mirror is no longer
available, so this small post-processing step restores each subject's official
Douban image URL while leaving every other CSV field untouched.
"""

from __future__ import annotations

import csv
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DOUBAN_USER = "elizen"
DOUBAN_API_KEY = "0ac44ae016490db2204ce0a042db2916"
API_URL = "https://frodo.douban.com/api/v2/user/{user}/interests"
USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 "
    "MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN"
)
REPO_ROOT = Path(__file__).resolve().parents[1]


def fetch_page(kind: str, start: int) -> dict:
    params = urlencode(
        {
            "type": kind,
            "status": "done",
            "count": 50,
            "start": start,
            "apiKey": DOUBAN_API_KEY,
        }
    )
    request = Request(
        f"{API_URL.format(user=DOUBAN_USER)}?{params}",
        headers={
            "User-Agent": USER_AGENT,
            "Referer": "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def official_posters(kind: str) -> dict[str, str]:
    posters: dict[str, str] = {}
    start = 0

    while True:
        payload = fetch_page(kind, start)
        interests = payload.get("interests", [])
        for interest in interests:
            subject = interest.get("subject") or {}
            subject_id = str(subject.get("id") or "")
            picture = subject.get("pic") or {}
            poster = picture.get("normal") or subject.get("cover_url") or ""
            if subject_id and poster:
                posters[subject_id] = poster

        start += len(interests)
        if not interests or start >= int(payload.get("total", 0)):
            break
        time.sleep(0.15)

    return posters


def update_csv(kind: str) -> None:
    csv_path = REPO_ROOT / "data" / "douban" / f"{kind}.csv"
    with csv_path.open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        fieldnames = reader.fieldnames
        rows = list(reader)

    if not fieldnames or "id" not in fieldnames or "poster" not in fieldnames:
        raise RuntimeError(f"Unexpected CSV format: {csv_path}")

    posters = official_posters(kind)
    updated = 0
    missing: set[str] = set()
    for row in rows:
        subject_id = row["id"]
        poster = posters.get(subject_id)
        if poster:
            if row["poster"] != poster:
                row["poster"] = poster
                updated += 1
        else:
            missing.add(subject_id)

    with csv_path.open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(
        f"{kind}: {len(rows)} rows, {updated} poster URLs updated, "
        f"{len(missing)} subjects without an official poster"
    )


if __name__ == "__main__":
    update_csv("movie")
    update_csv("book")
