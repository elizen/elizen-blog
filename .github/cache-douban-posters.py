#!/usr/bin/env python3
"""Download Douban covers into an ephemeral Hugo build directory.

The generated images are intentionally excluded from Git. Cloudflare Pages or
GitHub Actions creates them while building the site, then publishes them with
the generated HTML.
"""

from __future__ import annotations

import argparse
import csv
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
)


def poster_jobs(output: Path) -> list[tuple[str, Path]]:
    jobs: dict[Path, str] = {}
    for kind in ("movie", "book"):
        csv_path = REPO_ROOT / "data" / "douban" / f"{kind}.csv"
        with csv_path.open(newline="", encoding="utf-8") as source:
            for row in csv.DictReader(source):
                subject_id = row.get("id", "").strip()
                poster = row.get("poster", "").strip()
                if subject_id and poster:
                    jobs[output / kind / f"{subject_id}.jpg"] = poster
    return [(url, target) for target, url in jobs.items()]


def download(job: tuple[str, Path]) -> str:
    url, target = job
    if target.exists() and target.stat().st_size > 1024:
        return "cached"

    target.parent.mkdir(parents=True, exist_ok=True)
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": "https://www.douban.com/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )

    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                image = response.read()
                content_type = response.headers.get_content_type()
            if not content_type.startswith("image/") or len(image) <= 1024:
                raise RuntimeError("invalid image response")
            temporary = target.with_suffix(".jpg.tmp")
            temporary.write_bytes(image)
            temporary.replace(target)
            return "downloaded"
        except Exception:
            if attempt == 2:
                return "failed"
            time.sleep(0.5 * (attempt + 1))
    return "failed"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "static" / "images" / "douban",
        help="Directory that will contain movie/ and book/ cover folders",
    )
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    jobs = poster_jobs(args.output)
    counts = {"downloaded": 0, "cached": 0, "failed": 0}
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [executor.submit(download, job) for job in jobs]
        for future in as_completed(futures):
            counts[future.result()] += 1

    print(
        f"Douban covers: {counts['downloaded']} downloaded, "
        f"{counts['cached']} cached, {counts['failed']} failed"
    )
    if counts["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
