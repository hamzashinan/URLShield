#!/usr/bin/env python3
"""Backfill missing screenshot.png files for evidence packs."""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from yodhac.config import get_settings
from yodhac.scraper import Scraper


async def backfill(data_root: Path, domain: str | None = None) -> None:
    settings = get_settings()
    root = data_root or settings.data_root

    if not root.exists():
        print(f"Data root not found: {root}")
        return

    packs: list[Path] = []
    domain_dirs = [root / domain] if domain else [d for d in root.iterdir() if d.is_dir()]

    for domain_dir in domain_dirs:
        if domain_dir.name.startswith("."):
            continue
        for timestamp_dir in domain_dir.iterdir():
            if not timestamp_dir.is_dir():
                continue
            screenshot = timestamp_dir / "screenshot.png"
            if screenshot.exists() and screenshot.stat().st_size > 0:
                continue
            if not (timestamp_dir / "features.json").exists():
                continue
            packs.append(timestamp_dir)

    if not packs:
        print("No evidence packs need screenshot backfill.")
        return

    print(f"Backfilling {len(packs)} evidence pack(s)...")

    async with Scraper(settings) as scraper:
        for pack_dir in packs:
            label = f"{pack_dir.parent.name}/{pack_dir.name}"
            try:
                ok = await scraper.capture_screenshot_for_evidence(pack_dir)
                status = "OK" if ok else "FAILED"
                print(f"  [{status}] {label}")
            except Exception as exc:
                print(f"  [ERROR] {label}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-root",
        type=Path,
        default=None,
        help="Evidence data root (default: from settings)",
    )
    parser.add_argument(
        "--domain",
        type=str,
        default=None,
        help="Only backfill a single domain folder",
    )
    args = parser.parse_args()
    asyncio.run(backfill(args.data_root, args.domain))


if __name__ == "__main__":
    main()
