# Apple HIG Skills Versions

Current versions of all skills. Agents can compare against local versions to check for updates.

| Skill | Version | Last Updated |
|-------|---------|--------------|
| hig-project-context | 1.0.0 | 2025-02-02 |
| hig-platforms | 2.0.0 | 2026-06-11 |
| hig-foundations | 2.0.0 | 2026-06-11 |
| hig-patterns | 2.0.0 | 2026-06-11 |
| hig-components-content | 2.0.0 | 2026-06-11 |
| hig-components-layout | 2.0.0 | 2026-06-11 |
| hig-components-menus | 2.0.0 | 2026-06-11 |
| hig-components-search | 2.0.0 | 2026-06-11 |
| hig-components-dialogs | 2.0.0 | 2026-06-11 |
| hig-components-controls | 2.0.0 | 2026-06-11 |
| hig-components-status | 2.0.0 | 2026-06-11 |
| hig-components-system | 2.0.0 | 2026-06-11 |
| hig-inputs | 2.0.0 | 2026-06-11 |
| hig-technologies | 2.0.0 | 2026-06-11 |

## HIG Source

Content sourced from [Apple's Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) as of June 11, 2026.

## Recent Changes

### 2026-06-11
- **Full HIG re-scan (first content refresh since the Feb 2025 snapshot)** — major version bump (2.0.0) for all HIG content skills:
  - Rebuilt the entire reference corpus from Apple's live DocC JSON via the new `scripts/hig-ingest/` pipeline (`crawl.py` → `diff.py` → `convert.py` → `generate.py`), which walks the static JSON API rather than scraping JS-rendered HTML.
  - Reference files now reproduce Apple's full prose (intro context, guideline statements with rationale, lists, links) instead of the prior bold-only "structured index" skeleton. Imagery is still omitted; attribution + canonical-footer retained.
  - Captures the WWDC 2025 "Liquid Glass" overhaul across components, materials, and platforms.
  - New topics: `design-principles` (foundations), `snippets` (components/system experiences).
  - Renamed/merged: `spatial-interactions` → `nearby-interactions` (old file removed).
  - Apple reorganized Components into sub-groups (Content, Layout and organization, Menus and actions, Navigation and search, Presentation, Selection and input, Status, System experiences) — these are navigation pages mapped to existing skills.

### 2026-04-24
- **Tooling rework** (no change to skill content versions):
  - Audit CLI replaces the 0-100 score with severity buckets (critical/serious/moderate) and a `--fail-on` CI gate.
  - New MCP stdio server at `packages/hig-doctor/src-mcp/` exposing `hig_list_skills`, `hig_lookup`, and `hig_audit`.
  - GitHub Action repositioned from the internal skill validator to the audit CLI.
  - Website ships `/llms.txt` and `/raw/<slug>` agent-consumable endpoints.
  - Annual post-WWDC re-scan workflow opens a tracking issue each June 20.
  - Legal hardening pass: stripped 1,442 Apple-hosted image references across all 156 reference files and inserted a uniform attribution block under each frontmatter.

### 2025-02-02
- Initial release with 14 skills covering the complete Apple HIG plus project context management
