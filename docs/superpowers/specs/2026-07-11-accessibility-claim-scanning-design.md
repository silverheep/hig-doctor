# Accessibility Claim Scanning — Design

**Date**: 2026-07-11
**Status**: Approved design, pending implementation plan

## Goal

Add accessibility claim scanning to hig-doctor, grounded in Apple's accessibility
guidelines and the App Store Accessibility Nutrition Labels. Four capabilities:

1. **Declared-claim verification** — the project declares which Nutrition Label
   features it claims; the scanner checks the codebase for supporting or
   contradicting evidence.
2. **Readiness scoreboard for all categories** — every audit reports how close the
   project is to being able to claim each of the nine Nutrition Label features,
   whether declared or not.
3. **Deeper accessibility rules** — new Apple-accessibility-derived detection rules
   in the pattern engine.
4. **Copy/metadata cross-check** — accessibility claims stated in README/App Store
   metadata are extracted and checked against code evidence.

Delivery surfaces: the `hig-doctor` audit CLI, the `hig-mcp` server, and a new
Agent Skill.

## Non-goals and honesty framing

Static scanning cannot prove a Nutrition Label claim. Apple's bar is that **all
common tasks** (primary functionality, first launch, login, purchases, settings)
are completable with each feature — only manual testing verifies that. Every
output surface presents results as **readiness signals**, never certification,
with a standing disclaimer pointing to Accessibility Inspector and Apple's
evaluation criteria in App Store Connect help.

Runtime analysis (launching the app, Accessibility Inspector automation) is out of
scope. Web-only frameworks get no claim heuristics; Nutrition Labels apply to App
Store apps.

## Architecture (chosen: extend the pattern engine)

One deterministic core reused by all three surfaces. Rules in `patterns.ts` gain
an optional Nutrition Label tag; a new `claims.ts` module aggregates tagged
matches into per-category readiness; the audit pipeline, CLI, markdown report,
and MCP tool all consume that evaluation.

Rejected alternatives: a standalone `a11y` subcommand (duplicates scanner/report
infrastructure, splits the UX) and agent-driven assessment via MCP/skill only
(non-deterministic, not CI-usable).

## The nine Nutrition Label categories

From Apple's App Store Connect documentation (Overview of Accessibility Nutrition
Labels):

| Id | Label | Key criterion | Platform notes |
|----|-------|---------------|----------------|
| `voiceover` | VoiceOver | All common tasks completable with screen reader | |
| `voice-control` | Voice Control | All common tasks completable by voice | Not tvOS/watchOS |
| `larger-text` | Larger Text | Text scales to at least 200% | Not macOS |
| `dark-interface` | Dark Interface | Dark scheme on all screens and controls | |
| `differentiate-without-color` | Differentiate Without Color Alone | Key info not conveyed by color alone | |
| `sufficient-contrast` | Sufficient Contrast | WCAG contrast ratios met | |
| `reduced-motion` | Reduced Motion | Animations removable or reduced; honors system setting | |
| `captions` | Captions | Time-synchronized captions for all video/audio content | |
| `audio-descriptions` | Audio Descriptions | Time-synchronized narration for video content | |

## Components

### 1. `claims.ts` (new, `packages/hig-doctor/src-termcast/src/`)

- `NutritionLabel` union type of the nine category ids.
- `CLAIM_CATEGORIES`: per-category metadata — id, display label, Apple evaluation
  criterion, applicable platforms, App Store Connect help link.
- **Evaluator**: takes all `PatternMatch`es plus declared/stated claims, returns a
  `ClaimsEvaluation`:
  - Per category: supporting evidence (count + example `file:line`s),
    contradicting evidence (count + severity + examples), declared?, stated in
    copy?, readiness signal.
  - Readiness signals:
    - `ready-signal` — supporting evidence present, no serious/critical
      contradicting evidence.
    - `partial` — supporting evidence present alongside contradictions.
    - `at-risk` — any critical-severity contradicting evidence, or a
      declared/stated claim with zero supporting evidence.
    - `no-signal` — nothing detected either way (e.g., `captions` in a project
      with no media code). Categories whose platforms don't match the detected
      frameworks also report `no-signal` with a reason.
- **Config loader**: reads `.hig-doctor/accessibility-claims.json` from the
  audited project. Shape: `{ "claims": ["voiceover", "larger-text"] }`. Missing
  file → no declarations (scoreboard still renders). Malformed file or unknown
  ids → audit error with a clear message (exit 2 semantics in the CLI).
- **Copy-claim extractor**: scans `README*`, `fastlane/metadata/**`, and text
  files under common App Store metadata paths for claim-like phrases per
  category (e.g., "VoiceOver support", "supports Dynamic Type", "WCAG",
  "fully accessible"). Output: stated claims with source locations, fed into the
  evaluator and flagged distinctly ("stated in copy but not declared",
  "stated in README but contradicting evidence found").

### 2. Pattern rule changes (`patterns.ts`)

`PatternRule` and `PatternMatch` gain optional `claims?: NutritionLabel[]`.
Positive rules tagged with a category contribute supporting evidence;
concern rules contribute contradicting evidence. Existing accessibility rules
get tagged (e.g., `accessibilityLabel` → `voiceover`, `voice-control`;
`reduceMotion` → `reduced-motion`).

New rules, scoped to the App-Store-shippable framework set:

**SwiftUI / UIKit**
- Larger Text: positives — `dynamicTypeSize`, text styles (`.font(.body)` and
  friends), `adjustsFontForContentSizeCategory`; concerns — fixed
  `.font(.system(size:))` / `UIFont(ofSize:)`, `minimumScaleFactor` overuse.
- Reduced Motion: positives — existing `accessibilityReduceMotion`,
  `UIAccessibility.isReduceMotionEnabled`; concern — animation calls
  (`withAnimation`, `UIView.animate`) in files that never check the setting
  (document-scope rule with `requireAbsent`).
- Dark Interface: positives — `preferredColorScheme`, semantic/system colors;
  concerns — hardcoded hex/RGB color literals in UI code.
- Differentiate Without Color: positive —
  `accessibilityDifferentiateWithoutColorEnabled`.
- Sufficient Contrast: positives — `UIAccessibility.isDarkerSystemColorsEnabled`,
  `accessibilityContrast` / increase-contrast checks.
- Captions / Audio Descriptions: positives — `AVMediaCharacteristic.legible`,
  `.describesVideo`, `textStyleRules`. Only meaningful in projects importing
  AVFoundation/AVKit; otherwise the category remains `no-signal`.
- VoiceOver / Voice Control: primarily driven by the existing label/trait/hint
  rules — both features consume the same accessibility tree.

**React Native**
- Concern: `allowFontScaling={false}` (→ `larger-text`).
- Positives: `AccessibilityInfo.isReduceMotionEnabled` (→ `reduced-motion`),
  `useColorScheme` / `Appearance` (→ `dark-interface`); existing
  `accessibilityLabel`/`accessibilityRole` rules tagged for
  `voiceover`/`voice-control`.

**Flutter**
- Positives: `Semantics` widgets (→ `voiceover`, `voice-control`), `MediaQuery`
  `textScaler`/`boldText`/`highContrast`/`disableAnimations`/`platformBrightness`
  (→ respective categories).
- Concern: hardcoded `textScaleFactor: 1.0` (→ `larger-text`).

Web-only frameworks keep their existing untagged generic rules. `RULE_COUNT`
self-derives from the rule array. The website copy of `patterns.ts` is refreshed
via `npm run sync:audit-patterns` in the same change (root guard test enforces).

### 3. Audit pipeline (`audit.ts`)

New step between categorization and markdown generation: load claims config,
extract copy claims, run the evaluator. `AuditResult` gains
`claims: ClaimsEvaluation`. `AuditOptions` unchanged except plumbing.

### 4. CLI (`cli.ts`)

- **Default summary**: a "Nutrition Labels" scoreboard block after the category
  rows — nine rows with status glyphs (`✓` ready-signal, `◐` partial, `✗`
  at-risk, `–` no signal), a "declared" marker where the config claims the
  feature, and warning lines for copy/claim mismatches. For projects with no
  App-Store-shippable framework detected, the block is replaced by a one-line
  note that Nutrition Labels apply to App Store apps.
- **Markdown report** (`--export` / `--stdout`): new
  `## Accessibility Nutrition Label Readiness` section — per-category evidence
  with `file:line` examples, gaps to close, and the disclaimer.
- **`--json`**: additive `claims` object (per-category signal, evidence counts,
  declared/stated flags, mismatches). `schemaVersion` stays 1 — additive change.
- **New gate `--fail-on-claims`**: exit 1 if any *declared* claim evaluates to
  `at-risk`. Independent of and composable with the existing `--fail-on`
  severity gate. Help text and exit-code docs updated.

### 5. MCP server (`src-mcp/src/index.ts`)

No new tool. `hig_audit` already calls `audit()`; its JSON summary gains the same
additive `claims` block and the appended markdown report carries the readiness
section. The `hig_audit` tool description is updated to mention Nutrition Label
readiness so agents discover the capability.

### 6. New Agent Skill `skills/hig-accessibility-audit/` (v1.0.0)

- `SKILL.md` (<500 lines) with the standard required sections — Key Principles,
  Reference Index, Output Format, Questions to Ask, Related Skills — plus the
  `.claude/apple-design-context.md` context-check hint. It guides an agent
  through: running/interpreting the audit's claims output → a per-category
  manual verification checklist → remediation guidance.
- `references/nutrition-labels.md`: our own summary (not scraped Apple prose) of
  the nine categories, Apple's "all common tasks" bar, and links to App Store
  Connect help.
- `references/claim-evidence.md`: per-category code-evidence checklist — what the
  scanner looks for, what it cannot see, what to verify manually with
  Accessibility Inspector / VoiceOver.
- Frontmatter description includes trigger phrases ("nutrition label",
  "accessibility claims", "can I claim VoiceOver support").
- Related Skills: `hig-foundations` (accessibility, color, typography),
  `hig-inputs`. Those skills' Related Skills sections gain reciprocal mentions
  where appropriate.
- Registered in `VERSIONS.md` (with changelog entry) and in the marketplace
  manifest if it enumerates skills.

## Error handling

- Malformed or unknown-id claims config: fail the audit with a clear message
  (CLI exit 2; MCP `isError` result).
- Missing config: not an error — scoreboard renders without declarations.
- Copy-claim extraction is best-effort; unreadable metadata files are skipped
  silently (consistent with existing scanner behavior).
- Framework/platform mismatches (e.g., `larger-text` on a macOS-only project)
  degrade to `no-signal` with a stated reason, never a crash.

## Testing

- `claims.test.ts` (new): evaluator — declared vs undeclared, contradiction
  handling, `no-signal` cases, platform applicability, copy-claim extraction,
  config parsing (missing / malformed / unknown ids).
- `patterns.test.ts`: match and non-match fixtures for every new rule, in the
  existing table-driven style; claim-tag presence assertions.
- `audit-generator.test.ts`: readiness markdown section rendering.
- CLI: `--json` claims shape; `--fail-on-claims` exit codes.
- Repo guards: `npm run sync:audit-patterns` in the same change; `npm test`
  (workflow security + audit-patterns sync) and the skill validator
  (`node packages/hig-doctor/src/cli.js . --verbose`) pass — the new skill must
  satisfy the validator's required-sections profile.

## Docs and versioning

- README and AGENTS.md: add `claims.ts` to the structure map, document the
  config file, the scoreboard, `--fail-on-claims`, and the new skill.
- npm minor version bumps for `hig-doctor` (src-termcast) and `hig-mcp`.
- `VERSIONS.md`: new skill entry + changelog.
