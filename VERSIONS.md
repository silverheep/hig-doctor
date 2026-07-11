# Apple HIG Skills Versions

Current versions of all skills. Agents can compare against local versions to check for updates.

| Skill | Version | Last Updated |
|-------|---------|--------------|
| hig-project-context | 1.0.0 | 2025-02-02 |
| hig-platforms | 2.1.0 | 2026-07-08 |
| hig-foundations | 2.1.0 | 2026-07-08 |
| hig-patterns | 2.1.0 | 2026-07-08 |
| hig-components-content | 2.1.0 | 2026-07-08 |
| hig-components-layout | 2.1.0 | 2026-07-08 |
| hig-components-menus | 2.1.0 | 2026-07-08 |
| hig-components-search | 2.1.0 | 2026-07-08 |
| hig-components-dialogs | 2.0.0 | 2026-06-11 |
| hig-components-controls | 2.0.0 | 2026-06-11 |
| hig-components-status | 2.1.0 | 2026-07-08 |
| hig-components-system | 2.1.0 | 2026-07-08 |
| hig-inputs | 2.1.0 | 2026-07-08 |
| hig-technologies | 2.1.0 | 2026-07-08 |
| hig-accessibility-audit | 1.0.0 | 2026-07-11 |

## HIG Source

Content sourced from [Apple's Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/), re-verified against the live site on July 8, 2026. Files updated 2026-07-08 carry that snapshot stamp; files whose content was verified unchanged retain the 2026-06-11 stamp.

## Recent Changes

### 2026-07-11
- **New skill: `hig-accessibility-audit` (1.0.0)** — Accessibility Nutrition Label readiness guidance. Pairs with the audit CLI's new claim scanning (claim-tagged rules, `.hig-doctor/accessibility-claims.json`, readiness scoreboard, `--fail-on-claims`) and the `hig_audit` MCP claims summary.

### 2026-07-08
- **Corpus re-verified against Apple's live HIG; converter fidelity fixes** — minor version bump (2.1.0) for the 11 skills whose files changed:
  - Full re-crawl (172 topics) confirmed **zero Apple-side prose changes since 2026-06-11**: the topic tree is identical, and every page's newest change-log entry remains June 8, 2026 (WWDC 2026 / iOS 27 day-one updates, already captured by the June scan). Raw DocC JSON differences were limited to hashed image-asset URLs and `variantOverrides` ordering.
  - `convert.py` now renders three DocC block types it previously dropped, recovering ~7,900 words across 103 files:
    - `tabNavigator` — tabbed specs (screenshot-only tabs still render to nothing and are skipped). Recovers the full Dynamic Type size tables (xSmall–AX5) on `typography`, tvOS grid specs on `layout`, Game Center asset tables on `game-center`, and system haptic-pattern definitions on `playing-haptics`.
    - `small` — fine-print footnotes under spec tables (`typography`, `widgets`, `researchkit`).
    - `links` — "Videos" link grids in Resources sections, rendered as title + canonical-URL bullets (100 files gain WWDC session links, including WWDC 2026 sessions).
  - `video` blocks remain intentionally unrendered (bare asset identifiers; Apple-hosted media is never reproduced).
  - `hig-components-controls` and `hig-components-dialogs` had no content deltas (their tabs are all imagery) and stay at 2.0.0.
- **Audit-rule refresh against the post-WWDC-2026 corpus** (`website/lib/audit/patterns.ts` kept in sync; audit CLI 1.0.0 → 1.1.0, hig-mcp 0.1.0 → 0.2.0):
  - `ignoresSafeArea` concern re-labeled "backgrounds OK; keep controls/text in safe area" — under Liquid Glass, edge-to-edge content beneath bars is expected (see `layout.md`, `materials.md`); essential content must still respect safe areas.
  - `hardcodedColor` now also detects `.foregroundStyle(...)`/`.tint(...)` with hardcoded colors, not just the soft-deprecated `.foregroundColor(...)`.
  - `semanticColor` positive no longer credits the deprecated `.accentColor` *modifier*; credits `Color.accentColor` and `.tint(` instead.
  - `dynamicTypeStyle` positive now includes visionOS `extraLargeTitle`/`extraLargeTitle2`.
  - Layout checklist updated: "prefer tab bar; sidebar-adaptable tab bar or NavigationSplitView for complex hierarchies" replaces the outdated "tabs for flat, sidebar for deep".
  - Removed dead categorizer mappings and checklists for five component skills that don't exist (`selection`, `actions`, `presentation`, `textinput`, `media`).
  - MCP server snapshot constant bumped to 2026-07-08; `.claude-plugin/marketplace.json` description no longer claims "Snapshot Feb 2025" (now 1.2.0).
  - **11 new Liquid Glass-era rules** (RULE_COUNT 348 → 359), each grounded in the refreshed corpus: `glassEffect` adoption + a 5-per-file "use sparingly" concern (`materials.md`); scroll edge effects (`scroll-views.md`); `backgroundExtensionEffect` (`layout.md`, `sidebars.md`); tab bar minimize/bottom accessory (`tab-bars.md`); dedicated search tab positive + a TabView-with-searchable nudge (`search-fields.md` "Search as a tab"); `AppShortcutsProvider`, assistant schemas, `SnippetIntent`, and `FoundationModels` detection (`siri.md`, `app-shortcuts.md`, `snippets.md`, `generative-ai.md`). Rule-count references updated everywhere the old 348 appeared.

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
