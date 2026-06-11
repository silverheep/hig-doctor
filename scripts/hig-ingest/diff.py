#!/usr/bin/env python3
"""
Diff Apple's live HIG topic tree (from crawl.py's manifest) against the local
skills/*/references/*.md corpus.

Reports three buckets:
  ADDED    - live topics with no local reference file (new since the snapshot)
  REMOVED  - local reference files with no live topic (renamed or deprecated)
  COMMON   - present in both (candidates for content refresh)

Section index pages (foundations, components, ...) and the root are listed
separately since they are navigation, not leaf reference content.
"""
import argparse
import json
import os
import glob

# Live topics that are section/landing navigation, not leaf reference pages.
SECTION_PAGES = {
    "", "foundations", "components", "patterns", "inputs", "technologies",
    "getting-started",
}


def local_slugs(repo_root):
    out = {}
    for path in glob.glob(os.path.join(repo_root, "skills", "*", "references", "*.md")):
        slug = os.path.splitext(os.path.basename(path))[0]
        skill = path.split(os.sep)[-3]
        out[slug] = skill
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default=".hig-cache/manifest.json")
    ap.add_argument("--repo-root", default="../..")
    args = ap.parse_args()

    manifest = json.load(open(args.manifest))
    live = {t["slug"]: t for t in manifest["topics"]}
    live_leaf = {s: t for s, t in live.items() if s not in SECTION_PAGES}

    local = local_slugs(args.repo_root)

    added = sorted(set(live_leaf) - set(local))
    removed = sorted(set(local) - set(live_leaf))
    common = sorted(set(live_leaf) & set(local))

    print(f"Live topics:        {len(live)} ({len(live_leaf)} leaf + "
          f"{len(live) - len(live_leaf)} section)")
    print(f"Local reference md: {len(local)}")
    print(f"  ADDED (new live, no local file):   {len(added)}")
    print(f"  REMOVED (local file, not in live): {len(removed)}")
    print(f"  COMMON (in both):                  {len(common)}")

    print("\n== ADDED — new topics to create ==")
    for s in added:
        print(f"  + {s:40s} {live_leaf[s]['title']}")

    print("\n== REMOVED — local files with no live page (renamed/deprecated?) ==")
    for s in removed:
        print(f"  - {s:40s} (skills/{local[s]}/references/{s}.md)")

    report = {
        "added": [{"slug": s, "title": live_leaf[s]["title"]} for s in added],
        "removed": [{"slug": s, "skill": local[s]} for s in removed],
        "common": common,
        "section_pages": sorted(set(live) & SECTION_PAGES),
    }
    out_path = os.path.join(os.path.dirname(args.manifest), "diff.json")
    json.dump(report, open(out_path, "w"), indent=2)
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
