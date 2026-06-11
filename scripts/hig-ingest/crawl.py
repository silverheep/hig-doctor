#!/usr/bin/env python3
"""
Crawl Apple's Human Interface Guidelines DocC JSON tree.

Apple serves every HIG page as structured DocC render JSON at:
    https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json

This contradicts the repo's long-standing assumption that the HIG is
"JS-rendered and not safely automatable" — the JSON is static and complete.

This script does a breadth-first walk from a set of seed sections, following
every reference whose URL lives under /design/human-interface-guidelines/.
It writes the raw JSON for each discovered topic to a cache dir and emits a
manifest of every current topic slug.

Usage:
    python3 crawl.py --out .hig-cache [--refresh]
"""
import argparse
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://developer.apple.com/tutorials/data/design/human-interface-guidelines"
HIG_PATH = "/design/human-interface-guidelines/"

# Seeds: the top-level HIG landing plus its primary sections. BFS expands the rest.
SEEDS = [
    "",  # the landing page itself (human-interface-guidelines.json)
    "foundations",
    "components",
    "patterns",
    "inputs",
    "technologies",
    "getting-started",
]

UA = "hig-doctor-ingest/1.0 (+https://github.com/silverheep/hig-doctor)"


def slug_to_url(slug):
    if slug == "":
        return BASE + ".json"
    return f"{BASE}/{slug}.json"


def url_to_slug(url):
    """Map a HIG page URL to its topic slug (last path segment).

    Drops query strings and #fragment anchors — anchors point inside a page,
    not to a separate topic.
    """
    path = url.split("?")[0].split("#")[0].rstrip("/")
    if HIG_PATH.rstrip("/") not in path:
        return None
    after = path.split(HIG_PATH)[-1]
    if after == "" or "/" in after:
        # Landing page itself -> "", nested deeper -> take last segment
        return after.split("/")[-1] if after else ""
    return after


def fetch(slug, cache_dir, refresh=False):
    cache_file = os.path.join(cache_dir, (slug or "_root") + ".json")
    if os.path.exists(cache_file) and not refresh:
        with open(cache_file) as f:
            return slug, json.load(f), True
    url = slug_to_url(slug)
    # Fetch via curl: it uses the system keychain, which transparently handles
    # corporate SSL-interception certs that Python's bundled CA store rejects.
    try:
        proc = subprocess.run(
            ["curl", "-sSL", "--fail", "--max-time", "30", "-A", UA, url],
            capture_output=True, timeout=45,
        )
    except subprocess.TimeoutExpired:
        return slug, {"__error__": "timeout"}, False
    if proc.returncode != 0:
        return slug, {"__error__": f"curl exit {proc.returncode}"}, False
    try:
        data = json.loads(proc.stdout.decode("utf-8"))
    except json.JSONDecodeError as e:
        return slug, {"__error__": f"bad json: {e}"}, False
    with open(cache_file, "w") as f:
        json.dump(data, f)
    return slug, data, False


def child_slugs(data):
    """Every HIG topic slug referenced by this page (via the references map)."""
    out = set()
    for ref in (data.get("references") or {}).values():
        if ref.get("type") != "topic":
            continue
        url = ref.get("url", "")
        if HIG_PATH in url:
            s = url_to_slug(url)
            if s:
                out.add(s)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=".hig-cache", help="cache + manifest dir")
    ap.add_argument("--refresh", action="store_true", help="re-fetch even if cached")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    cache_dir = os.path.join(args.out, "json")
    os.makedirs(cache_dir, exist_ok=True)

    seen = set()
    queue = list(SEEDS)
    discovered = {}  # slug -> {title, url, has_content}
    errors = {}

    pool = ThreadPoolExecutor(max_workers=args.workers)
    fetched_live = 0
    while queue:
        batch = [s for s in queue if s not in seen]
        for s in batch:
            seen.add(s)
        queue = []
        futures = {pool.submit(fetch, s, cache_dir, args.refresh): s for s in batch}
        for fut in as_completed(futures):
            slug, data, cached = fut.result()
            if not cached:
                fetched_live += 1
                time.sleep(0.05)  # be polite to Apple
            if "__error__" in data:
                errors[slug] = data["__error__"]
                continue
            # Record this topic
            meta = data.get("metadata", {})
            title = meta.get("title", slug)
            discovered[slug] = {
                "slug": slug,
                "title": title,
                "has_content": bool(data.get("primaryContentSections")),
            }
            # Enqueue children
            for c in child_slugs(data):
                if c not in seen:
                    queue.append(c)
        print(f"  ...discovered {len(discovered)}, queue {len(queue)}, "
              f"live fetches {fetched_live}", file=sys.stderr)

    pool.shutdown()

    manifest = {
        "base": BASE,
        "topics": sorted(discovered.values(), key=lambda d: d["slug"]),
        "count": len(discovered),
        "errors": errors,
    }
    manifest_path = os.path.join(args.out, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nDiscovered {len(discovered)} topics "
          f"({sum(1 for d in discovered.values() if d['has_content'])} with content).")
    if errors:
        print(f"Errors on {len(errors)} slugs: {sorted(errors)[:10]}...")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
