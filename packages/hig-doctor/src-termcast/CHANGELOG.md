# Changelog

All notable changes to `hig-doctor` (the Apple HIG audit CLI) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-07-11

### Added

- Accessibility Nutrition Label claim scanning: 21 new claim-tagged rules
  (RULE_COUNT 359 → 380) evaluating readiness for all nine App Store
  accessibility claims (VoiceOver, Voice Control, Larger Text, Dark Interface,
  Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion,
  Captions, Audio Descriptions).
- Readiness scoreboard in terminal, markdown, and JSON output, built from
  claim-tagged rule evidence.
- `.hig-doctor/accessibility-claims.json` for declaring intended App Store
  accessibility claims, plus stated-claim extraction from README and fastlane
  metadata.
- `--fail-on-claims` CI gate that exits non-zero when a declared or stated
  claim lacks sufficient rule evidence.

## [1.1.0] - 2026-07-08

Rules verified against the post-WWDC 2026 (iOS 27) Human Interface Guidelines.

### Added

- 11 Liquid Glass-era rules (total now **359**), grounded in the June 2026 HIG:
  - `glassEffect` adoption (positive) and a document-scoped concern when a
    single file applies 5+ glass effects ("use Liquid Glass sparingly").
  - Scroll edge effects (`scrollEdgeEffectStyle` / `UIScrollEdgeEffect` /
    `NSScrollEdgeEffectStyle`) and `backgroundExtensionEffect()` /
    `UIBackgroundExtensionView` as positives.
  - Tab bar minimize behavior / bottom accessory adoption (positive).
  - Dedicated search tab (`Tab(role: .search)` / `UISearchTab`) as a positive,
    plus a file-level nudge when `TabView` and `.searchable` coexist without one.
  - App Intents surface: `AppShortcutsProvider` (pattern), assistant schemas
    (`@AssistantIntent` / `@AssistantEntity` / `@AssistantEnum`, positive),
    interactive snippets (`SnippetIntent`, positive), and `FoundationModels`
    usage (pattern).

### Changed

- `hardcodedColor` now also catches hardcoded colors passed to
  `.foregroundStyle(...)` and `.tint(...)`, not just the soft-deprecated
  `.foregroundColor(...)`.
- `semanticColor` no longer credits the deprecated `.accentColor` modifier;
  it credits `Color.accentColor` and `.tint(` instead.
- `dynamicTypeStyle` now includes visionOS `extraLargeTitle` / `extraLargeTitle2`.
- `ignoresSafeArea` concern re-scoped: "backgrounds OK; keep controls/text in
  safe area" — edge-to-edge content is expected under Liquid Glass.
- Layout checklist now reads "prefer tab bar; sidebar-adaptable tab bar or
  NavigationSplitView for complex hierarchies" (was "tabs for flat, sidebar
  for deep").

### Removed

- Dead categorizer mappings and checklists for five component categories that
  never existed as skills (selection, actions, presentation, textinput, media).

## [1.0.0] - 2026-05-28

Initial public release on npm.

### Added

- HIG compliance auditor covering **348 rules** across 12 frameworks: SwiftUI,
  UIKit, AppKit, React, React Native, Flutter, Vue, Svelte, Angular, Jetpack
  Compose, Android XML, and plain HTML/CSS.
- Severity model — findings are graded **critical**, **serious**, or **moderate**,
  alongside detected positive patterns.
- Output modes: pretty terminal summary (default), `--export` (writes
  `hig-audit.md`), `--stdout` (full markdown to stdout), and `--json` (machine
  output to stdout, progress to stderr).
- `--fail-on <critical|serious|moderate>` CI gate that exits non-zero when a
  finding at or above the given severity is present.
- `--exclude <glob>` flag and `.higauditignore` file support for skipping paths,
  with `.gitignore`-style glob matching (`*`, `**`, `?`, directory pruning).
- Node 20+ distribution: the published package is an esbuild bundle
  (`dist/index.js`) with zero runtime dependencies. Also runs directly under Bun
  from source.

### Notes

- Detection is fully local — no source ever leaves the machine, no network calls.
- The published package does not redistribute Apple's Human Interface Guidelines
  reference content; it ships only the auditor.
