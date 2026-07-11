# Accessibility Claim Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Accessibility Nutrition Label claim scanning to the hig-doctor audit CLI, MCP server, and Agent Skills, per `docs/superpowers/specs/2026-07-11-accessibility-claim-scanning-design.md`.

**Architecture:** Pattern rules in `patterns.ts` gain an optional `claims` tag mapping them to the nine Nutrition Label categories. A new `claims.ts` module aggregates tagged matches, declared claims (from `.hig-doctor/accessibility-claims.json`), and copy-stated claims (from README/fastlane metadata) into per-category readiness signals. The audit pipeline, CLI, markdown report, and MCP server all consume that one deterministic evaluation. A new `hig-accessibility-audit` skill guides manual verification.

**Tech Stack:** TypeScript on Bun (`packages/hig-doctor/src-termcast`, `packages/hig-doctor/src-mcp`), `bun test`, Node 20+ for the published bundles. No new dependencies.

## Global Constraints

- **`patterns.ts` must stay import-free.** `website/lib/audit/patterns.ts` is a byte-identical copy enforced by `test/audit-patterns-sync.test.mjs`. The `NutritionLabel` type is therefore DEFINED in `patterns.ts`, never imported into it.
- **After every change to `patterns.ts`:** run `npm run sync:audit-patterns` from the repo root and commit both copies in the same commit.
- The nine category ids, exactly: `voiceover`, `voice-control`, `larger-text`, `dark-interface`, `differentiate-without-color`, `sufficient-contrast`, `reduced-motion`, `captions`, `audio-descriptions`.
- The four readiness signals, exactly: `ready-signal`, `partial`, `at-risk`, `no-signal`.
- The disclaimer copy, verbatim wherever shown: "Readiness signals are heuristics from static code analysis — they are not certification. Apple requires that all common tasks be completable with each feature; verify manually with Accessibility Inspector and assistive technologies before declaring support in App Store Connect."
- Claims config path, exactly: `.hig-doctor/accessibility-claims.json` (relative to the audited project).
- `RULE_COUNT` is 359 today; Task 2 takes it to 372, Task 3 to 380. `EXPECTED_RULE_COUNT` in `patterns.test.ts` is updated in the same task as each rule change. Prose/doc occurrences of the count are updated ONCE, in Task 12.
- Conventional Commits. No emojis anywhere in skill files.
- All commands below run from `/Users/davidbridge/src/hig-doctor` unless a `cd` is shown.
- Work on branch `feature/accessibility-claim-scanning` (create in Task 1, Step 0).

## Agentic Workflow Execution Notes

Tasks are SEQUENTIAL (most share files: `patterns.ts` for 1–3, `claims.ts` for 5–7, `cli.ts`/`audit.ts` for 8–9). Run one implementer subagent per task, review between tasks. Suggested model per task (Opus = regex/logic-heavy, Sonnet = mechanical):

| Task | Model | Task | Model |
|------|-------|------|-------|
| 1 claims plumbing + tags | opus | 7 evaluator | opus |
| 2 Swift rules | opus | 8 pipeline + report | opus |
| 3 RN/Flutter rules | sonnet | 9 CLI surface | opus |
| 4 scanner doc files | sonnet | 10 MCP | sonnet |
| 5 claims core/config | sonnet | 11 skill + registry | sonnet |
| 6 copy extractor | sonnet | 12 docs + verification | sonnet |

---

## File Structure

- Modify: `packages/hig-doctor/src-termcast/src/patterns.ts` — `NutritionLabel` type, `claims` field, rule tags, 21 new rules (Tasks 1–3)
- Modify: `packages/hig-doctor/src-termcast/src/patterns.test.ts` — tag/rule tests, `EXPECTED_RULE_COUNT` bumps (Tasks 1–3)
- Modify: `website/lib/audit/patterns.ts` — synced copy (Tasks 1–3, via `npm run sync:audit-patterns`)
- Modify: `packages/hig-doctor/src-termcast/src/scanner.ts` — `docFiles` collection (Task 4)
- Modify: `packages/hig-doctor/src-termcast/src/scanner.test.ts` — doc-file tests (Task 4)
- Create: `packages/hig-doctor/src-termcast/src/claims.ts` — categories, config loader, extractor, evaluator (Tasks 5–7)
- Create: `packages/hig-doctor/src-termcast/src/claims.test.ts` — unit tests (Tasks 5–7)
- Modify: `packages/hig-doctor/src-termcast/src/audit.ts` + `audit-generator.ts` (+ their tests) — pipeline + markdown section (Task 8)
- Modify: `packages/hig-doctor/src-termcast/src/cli.ts` — scoreboard, `--fail-on-claims`, JSON (Task 9)
- Modify: `packages/hig-doctor/src-mcp/src/index.ts` — claims in `hig_audit` summary (Task 10)
- Create: `skills/hig-accessibility-audit/SKILL.md`, `references/nutrition-labels.md`, `references/claim-evidence.md`; Modify: `VERSIONS.md`, `.claude-plugin/marketplace.json` (Task 11)
- Modify: `README.md`, `AGENTS.md`, package versions, rule-count doc spots (Task 12)

---

### Task 1: Claim plumbing in patterns.ts + tag existing rules

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/patterns.ts`
- Modify: `packages/hig-doctor/src-termcast/src/patterns.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 2–3, 5–7):
  - `export type NutritionLabel = "voiceover" | "voice-control" | "larger-text" | "dark-interface" | "differentiate-without-color" | "sufficient-contrast" | "reduced-motion" | "captions" | "audio-descriptions";` (in `patterns.ts`)
  - `PatternMatch` gains `claims?: NutritionLabel[]`
  - `PatternRule` (internal) gains `claims?: NutritionLabel[]`
  - `detectPatterns` copies `rule.claims` onto every match it emits for that rule.
- `RULE_COUNT` stays **359** in this task.

- [ ] **Step 0: Create the working branch**

```bash
git checkout -b feature/accessibility-claim-scanning
```

- [ ] **Step 1: Write the failing tests**

Append to `packages/hig-doctor/src-termcast/src/patterns.test.ts`:

```ts
// ════════════════════════════════════════════════════════════════
// NUTRITION LABEL CLAIM TAGS
// ════════════════════════════════════════════════════════════════
describe("claim tags", () => {
  test("propagates claim tags on Swift accessibility positives", () => {
    const matches = detectPatterns(`.accessibilityLabel("Close")`, "View.swift");
    const m = matches.find(m => m.pattern === "accessibilityLabel");
    expect(m?.claims).toEqual(["voiceover", "voice-control"]);
  });
  test("claim-tagged concern keeps its severity", () => {
    const matches = detectPatterns(`.font(.system(size: 14))`, "View.swift");
    const m = matches.find(m => m.pattern === "hardcodedFontSize");
    expect(m?.claims).toEqual(["larger-text"]);
    expect(m?.severity).toBe("moderate");
  });
  test("untagged rules carry no claims field", () => {
    const matches = detectPatterns(`TabView {}`, "View.swift");
    const m = matches.find(m => m.pattern === "TabView");
    expect(m?.claims).toBeUndefined();
  });
  test("tags React Native and Flutter accessibility rules", () => {
    const rn = detectPatterns(`<Pressable accessibilityLabel="Send" />`, "App.tsx");
    expect(rn.find(m => m.pattern === "accessibilityLabel")?.claims).toEqual(["voiceover", "voice-control"]);
    const fl = detectPatterns(`Semantics(label: "Send", child: button)`, "app.dart");
    expect(fl.find(m => m.pattern === "Semantics widget")?.claims).toEqual(["voiceover", "voice-control"]);
  });
  test("tags dark-interface on Swift color rules", () => {
    const matches = detectPatterns(`.preferredColorScheme(.dark)`, "View.swift");
    expect(matches.find(m => m.pattern === "preferredColorScheme")?.claims).toEqual(["dark-interface"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/hig-doctor/src-termcast && bun test src/patterns.test.ts
```
Expected: the five new tests FAIL (`claims` is `undefined`); all pre-existing tests PASS.

- [ ] **Step 3: Implement the plumbing**

In `packages/hig-doctor/src-termcast/src/patterns.ts`:

3a. After the `export type Severity` line, add:

```ts
// App Store Accessibility Nutrition Label categories. Rules tagged with a
// category contribute claim evidence: positive rules support the claim,
// concern rules contradict it. Defined here (not in claims.ts) because this
// module must stay import-free — website/lib/audit/patterns.ts is a
// byte-identical copy.
export type NutritionLabel =
  | "voiceover"
  | "voice-control"
  | "larger-text"
  | "dark-interface"
  | "differentiate-without-color"
  | "sufficient-contrast"
  | "reduced-motion"
  | "captions"
  | "audio-descriptions";
```

3b. Add `claims?: NutritionLabel[];` to BOTH the `PatternMatch` interface and the `PatternRule` interface (after their `severity?`/`requireAbsent?` members respectively, with a comment on `PatternRule`: `// Nutrition Label categories this rule evidences (positive=supports, concern=contradicts)`).

3c. In `detectPatterns`, both `matches.push({...})` sites (the line-scope one and the document-scope one) gain, after the `severity:` property:

```ts
          ...(rule.claims ? { claims: rule.claims } : {}),
```

3d. Tag existing rules. For each rule below, identified by its exact `pattern` string, append `, claims: [...]` inside the rule object (before the closing `}`). Do not touch any other rule.

Swift rules:

| pattern | claims |
|---|---|
| `hardcodedColor` | `["dark-interface"]` |
| `hardcodedRGBColor` | `["dark-interface"]` |
| `hardcodedUIColor` | `["dark-interface"]` |
| `hardcoded Color(uiColor:)` | `["dark-interface"]` |
| `semanticColor` | `["dark-interface", "sufficient-contrast"]` |
| `foregroundStyle` | `["dark-interface", "sufficient-contrast"]` |
| `assetCatalogColor` | `["dark-interface"]` |
| `dynamicTypeStyle` | `["larger-text"]` |
| `hardcodedFontSize` | `["larger-text"]` |
| `hardcodedUIFont` | `["larger-text"]` |
| `scaledMetric` | `["larger-text"]` |
| `accessibilityLabel` | `["voiceover", "voice-control"]` |
| `accessibilityHint` | `["voiceover", "voice-control"]` |
| `accessibilityHidden` | `["voiceover"]` |
| `accessibilityAddTraits` | `["voiceover", "voice-control"]` |
| `accessibilityValue` | `["voiceover", "voice-control"]` |
| `accessibilityAction` | `["voiceover", "voice-control"]` |
| `reduceMotion` | `["reduced-motion"]` |
| `onTapGesture without traits` | `["voiceover", "voice-control"]` |
| `Image without a11y` | `["voiceover"]` |
| `isAccessibilityElement false on interactive` | `["voiceover", "voice-control"]` |
| `colorScheme` | `["dark-interface"]` |
| `preferredColorScheme` | `["dark-interface"]` |

React Native rules (in `reactNativeRules`):

| pattern | claims |
|---|---|
| `accessibilityLabel` | `["voiceover", "voice-control"]` |
| `accessibilityRole` | `["voiceover", "voice-control"]` |
| `accessibilityHint` | `["voiceover", "voice-control"]` |
| `accessibilityState` | `["voiceover", "voice-control"]` |
| `accessible={true}` | `["voiceover", "voice-control"]` |
| `useColorScheme` | `["dark-interface"]` |
| `nested touchables` | `["voiceover"]` |

Flutter rules (in `flutterRules`):

| pattern | claims |
|---|---|
| `Semantics widget` | `["voiceover", "voice-control"]` |
| `ExcludeSemantics` | `["voiceover"]` |
| `MergeSemantics` | `["voiceover"]` |
| `semanticLabel` | `["voiceover", "voice-control"]` |
| `Theme color` | `["dark-interface"]` |
| `hardcoded Color` | `["dark-interface"]` |
| `Colors.red/blue` | `["dark-interface"]` |
| `Theme text style` | `["larger-text"]` |
| `hardcoded fontSize` | `["larger-text"]` |
| `brightness detection` | `["dark-interface"]` |
| `darkTheme` | `["dark-interface"]` |

Kotlin/Compose, Android XML, web, CSS, Vue, Svelte, Angular rules stay untagged (Nutrition Labels are an App Store concept; web-only frameworks are out of scope).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/hig-doctor/src-termcast && bun test src/patterns.test.ts && bun run typecheck
```
Expected: ALL PASS, including `rule count is exactly 359` (no rules added).

- [ ] **Step 5: Sync the website copy and verify**

```bash
npm run sync:audit-patterns && npm run test:audit-sync
```
Expected: sync test PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/hig-doctor/src-termcast/src/patterns.ts packages/hig-doctor/src-termcast/src/patterns.test.ts website/lib/audit/patterns.ts
git commit -m "feat(audit): add Nutrition Label claim tags to pattern rules"
```

---

### Task 2: New Swift claim-evidence rules (+13, RULE_COUNT 359 → 372)

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/patterns.ts` (Swift accessibility section, after the `isAccessibilityElement false on interactive` rule)
- Modify: `packages/hig-doctor/src-termcast/src/patterns.test.ts`

**Interfaces:**
- Consumes: `NutritionLabel`, `claims` field from Task 1.
- Produces: 13 new Swift rules with the exact `pattern` strings listed below (Task 7's evaluator and Task 12's docs reference nothing by name; only tests do).

- [ ] **Step 1: Write the failing tests**

Append to `patterns.test.ts`:

```ts
// ════════════════════════════════════════════════════════════════
// SWIFT — Nutrition Label claim evidence rules
// ════════════════════════════════════════════════════════════════
describe("claim evidence — Swift", () => {
  test("detects dynamicTypeSize as larger-text evidence", () => {
    const a = detectPatterns(`.dynamicTypeSize(.large ... .accessibility3)`, "V.swift");
    expect(a.find(m => m.pattern === "dynamicTypeSize")?.claims).toEqual(["larger-text"]);
    const b = detectPatterns(`@Environment(\\.dynamicTypeSize) var size`, "V.swift");
    expect(b.some(m => m.pattern === "dynamicTypeSize")).toBe(true);
  });
  test("detects UIKit Dynamic Type adoption", () => {
    const m = detectPatterns(`label.adjustsFontForContentSizeCategory = true\nlabel.font = UIFont.preferredFont(forTextStyle: .body)`, "VC.swift");
    expect(m.some(x => x.pattern === "adjustsFontForContentSizeCategory")).toBe(true);
    expect(m.some(x => x.pattern === "preferredFont(forTextStyle:)")).toBe(true);
  });
  test("flags aggressive minimumScaleFactor", () => {
    const bad = detectPatterns(`.minimumScaleFactor(0.4)`, "V.swift");
    expect(bad.some(m => m.pattern === "minimumScaleFactor below 0.5" && m.type === "concern" && m.severity === "moderate")).toBe(true);
    const ok = detectPatterns(`.minimumScaleFactor(0.8)`, "V.swift");
    expect(ok.some(m => m.pattern === "minimumScaleFactor below 0.5")).toBe(false);
  });
  test("animation without Reduce Motion check fires once per unguarded file", () => {
    const bad = detectPatterns(`withAnimation { x = 1 }\nwithAnimation { y = 2 }`, "V.swift");
    expect(bad.filter(m => m.pattern === "animation without Reduce Motion check").length).toBe(1);
    const good = detectPatterns(`@Environment(\\.accessibilityReduceMotion) var reduce\nwithAnimation { x = 1 }`, "V.swift");
    expect(good.some(m => m.pattern === "animation without Reduce Motion check")).toBe(false);
    const uikit = detectPatterns(`if UIAccessibility.isReduceMotionEnabled { }\nUIView.animate(withDuration: 0.3) {}`, "VC.swift");
    expect(uikit.some(m => m.pattern === "animation without Reduce Motion check")).toBe(false);
  });
  test("detects contrast and differentiate-without-color checks", () => {
    const m = detectPatterns(`@Environment(\\.accessibilityDifferentiateWithoutColor) var dwc\nif UIAccessibility.isDarkerSystemColorsEnabled {}`, "V.swift");
    expect(m.find(x => x.pattern === "differentiate without color check")?.claims).toEqual(["differentiate-without-color"]);
    expect(m.find(x => x.pattern === "increase contrast check")?.claims).toEqual(["sufficient-contrast"]);
  });
  test("detects caption/audio-description media selection", () => {
    const m = detectPatterns(`let g = asset.mediaSelectionGroup(forMediaCharacteristic: AVMediaCharacteristic.legible)\nopts.describesVideo`, "Player.swift");
    expect(m.find(x => x.pattern === "caption media selection")?.claims).toEqual(["captions"]);
    expect(m.find(x => x.pattern === "audio description media selection")?.claims).toEqual(["audio-descriptions"]);
  });
  test("flags AVPlayer without caption selection, once per file", () => {
    const bad = detectPatterns(`let p = AVPlayer(url: url)\nlet q = AVPlayer(url: other)`, "Player.swift");
    expect(bad.filter(m => m.pattern === "AVPlayer without caption selection").length).toBe(1);
    const good = detectPatterns(`let p = AVPlayer(url: url)\nitem.select(option, in: group) // textStyleRules applied\nlet r = AVTextStyleRule(textMarkupAttributes: [:])\nplayer.currentItem?.textStyleRules = [r]`, "Player.swift");
    expect(good.some(m => m.pattern === "AVPlayer without caption selection")).toBe(false);
  });
  test("detects VoiceOver announcements and element grouping", () => {
    const m = detectPatterns(`UIAccessibility.post(notification: .announcement, argument: "Saved")\n.accessibilityElement(children: .combine)`, "V.swift");
    expect(m.some(x => x.pattern === "VoiceOver announcement")).toBe(true);
    expect(m.find(x => x.pattern === "accessibilityElement grouping")?.claims).toEqual(["voiceover", "voice-control"]);
  });
});
```

Update the count guard in `patterns.test.ts`: `const EXPECTED_RULE_COUNT = 372;`

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/hig-doctor/src-termcast && bun test src/patterns.test.ts
```
Expected: new describe-block FAILS; count test FAILS (still 359).

- [ ] **Step 3: Add the 13 rules**

In `patterns.ts`, inside `swiftRules`, immediately after the `isAccessibilityElement false on interactive` rule, insert:

```ts
  // Nutrition Label claim evidence (Accessibility Nutrition Labels, App Store Connect)
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "dynamicTypeSize", regex: /\.dynamicTypeSize\(|@Environment\(\\\.dynamicTypeSize\)/, fileFilter: SWIFT, claims: ["larger-text"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "adjustsFontForContentSizeCategory", regex: /adjustsFontForContentSizeCategory\s*=\s*true/, fileFilter: SWIFT, claims: ["larger-text"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "preferredFont(forTextStyle:)", regex: /UIFont\.preferredFont\(\s*forTextStyle:/, fileFilter: SWIFT, claims: ["larger-text"] },
  { category: "foundations", subcategory: "accessibility", type: "concern", pattern: "minimumScaleFactor below 0.5", regex: /\.minimumScaleFactor\(\s*0?\.[0-4]/, fileFilter: SWIFT, claims: ["larger-text"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "isReduceMotionEnabled (UIKit)", regex: /UIAccessibility\.isReduceMotionEnabled/, fileFilter: SWIFT, claims: ["reduced-motion"] },
  // Fires once per file that animates without ever consulting Reduce Motion.
  { category: "foundations", subcategory: "accessibility", type: "concern", pattern: "animation without Reduce Motion check", regex: /\bwithAnimation\b|UIView\.animate\(|\.animation\(/, fileFilter: SWIFT, scope: "document", requireAbsent: /accessibilityReduceMotion|isReduceMotionEnabled/, claims: ["reduced-motion"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "increase contrast check", regex: /accessibilityContrast|isDarkerSystemColorsEnabled|colorSchemeContrast/, fileFilter: SWIFT, claims: ["sufficient-contrast"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "differentiate without color check", regex: /accessibilityDifferentiateWithoutColor|shouldDifferentiateWithoutColor/, fileFilter: SWIFT, claims: ["differentiate-without-color"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "caption media selection", regex: /AVMediaCharacteristic\.legible|textStyleRules/, fileFilter: SWIFT, claims: ["captions"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "audio description media selection", regex: /describesVideo/, fileFilter: SWIFT, claims: ["audio-descriptions"] },
  // Fires once per file that creates players without any caption plumbing.
  { category: "foundations", subcategory: "accessibility", type: "concern", pattern: "AVPlayer without caption selection", regex: /\bAVPlayer(?:ViewController)?\b/, fileFilter: SWIFT, scope: "document", requireAbsent: /AVMediaCharacteristic\.legible|textStyleRules|selectMediaOption|select\(/, claims: ["captions"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "VoiceOver announcement", regex: /UIAccessibility\.post\(|AccessibilityNotification\./, fileFilter: SWIFT, claims: ["voiceover"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "accessibilityElement grouping", regex: /\.accessibilityElement\(/, fileFilter: SWIFT, claims: ["voiceover", "voice-control"] },
```

No `CRITICAL_CONCERNS`/`SERIOUS_CONCERNS` additions — the three new concerns are heuristic and stay moderate (matching the documented policy in that file).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/hig-doctor/src-termcast && bun test src/patterns.test.ts && bun run typecheck
```
Expected: ALL PASS including `rule count is exactly 372`.

- [ ] **Step 5: Sync website copy, commit**

```bash
npm run sync:audit-patterns && npm run test:audit-sync
git add packages/hig-doctor/src-termcast/src/patterns.ts packages/hig-doctor/src-termcast/src/patterns.test.ts website/lib/audit/patterns.ts
git commit -m "feat(audit): add 13 Swift Nutrition Label evidence rules"
```

---

### Task 3: New React Native + Flutter claim rules (+8, RULE_COUNT 372 → 380)

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/patterns.ts` (`reactNativeRules` and `flutterRules` arrays)
- Modify: `packages/hig-doctor/src-termcast/src/patterns.test.ts`

**Interfaces:**
- Consumes: Task 1 plumbing.
- Produces: rules with `pattern` strings: `allowFontScaling false`, `reduce motion check (RN)`, `font scale awareness (RN)`, `textScaler awareness`, `fixed textScaleFactor`, `disableAnimations check`, `highContrast check`, `boldText check`. Two new SERIOUS severities.

- [ ] **Step 1: Write the failing tests**

Append to `patterns.test.ts`:

```ts
// ════════════════════════════════════════════════════════════════
// RN + FLUTTER — Nutrition Label claim evidence rules
// ════════════════════════════════════════════════════════════════
describe("claim evidence — React Native", () => {
  test("flags allowFontScaling={false} as serious larger-text concern", () => {
    const m = detectPatterns(`<Text allowFontScaling={false}>Hi</Text>`, "App.tsx");
    const hit = m.find(x => x.pattern === "allowFontScaling false");
    expect(hit?.type).toBe("concern");
    expect(hit?.severity).toBe("serious");
    expect(hit?.claims).toEqual(["larger-text"]);
  });
  test("detects RN reduce-motion and font-scale checks", () => {
    const m = detectPatterns(`const rm = await AccessibilityInfo.isReduceMotionEnabled();\nconst s = PixelRatio.getFontScale();`, "App.ts");
    expect(m.find(x => x.pattern === "reduce motion check (RN)")?.claims).toEqual(["reduced-motion"]);
    expect(m.find(x => x.pattern === "font scale awareness (RN)")?.claims).toEqual(["larger-text"]);
  });
});

describe("claim evidence — Flutter", () => {
  test("detects textScaler awareness, flags pinned scale as serious", () => {
    const good = detectPatterns(`final scaler = MediaQuery.textScalerOf(context);`, "app.dart");
    expect(good.find(x => x.pattern === "textScaler awareness")?.claims).toEqual(["larger-text"]);
    const bad = detectPatterns(`MediaQueryData(textScaleFactor: 1.0)`, "app.dart");
    const hit = bad.find(x => x.pattern === "fixed textScaleFactor");
    expect(hit?.severity).toBe("serious");
    const alsoBad = detectPatterns(`textScaler: TextScaler.noScaling`, "app.dart");
    expect(alsoBad.some(x => x.pattern === "fixed textScaleFactor")).toBe(true);
  });
  test("detects disableAnimations, highContrast, boldText checks", () => {
    const m = detectPatterns(`if (MediaQuery.of(context).disableAnimations) {}\nfinal hc = MediaQuery.highContrastOf(context);\nfinal bold = MediaQuery.boldTextOf(context);`, "app.dart");
    expect(m.find(x => x.pattern === "disableAnimations check")?.claims).toEqual(["reduced-motion"]);
    expect(m.find(x => x.pattern === "highContrast check")?.claims).toEqual(["sufficient-contrast"]);
    expect(m.find(x => x.pattern === "boldText check")?.claims).toEqual(["larger-text"]);
  });
});
```

Update the count guard: `const EXPECTED_RULE_COUNT = 380;`

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/hig-doctor/src-termcast && bun test src/patterns.test.ts
```
Expected: new tests FAIL; count test FAILS (372).

- [ ] **Step 3: Add the rules and severities**

3a. Append to `reactNativeRules` (before the closing `];`):

```ts
  // Nutrition Label claim evidence
  { category: "foundations", subcategory: "accessibility", type: "concern", pattern: "allowFontScaling false", regex: /allowFontScaling=\{?\s*false/, fileFilter: TSX_JSX, claims: ["larger-text"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "reduce motion check (RN)", regex: /AccessibilityInfo\.isReduceMotionEnabled/, fileFilter: TS_JS, claims: ["reduced-motion"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "font scale awareness (RN)", regex: /PixelRatio\.getFontScale|\bfontScale\b/, fileFilter: TS_JS, claims: ["larger-text"] },
```

3b. Append to `flutterRules` (before the closing `];`):

```ts
  // Nutrition Label claim evidence
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "textScaler awareness", regex: /MediaQuery\.textScalerOf|\.textScaler\b(?!:)|textScaleFactorOf/, fileFilter: DART, claims: ["larger-text"] },
  { category: "foundations", subcategory: "accessibility", type: "concern", pattern: "fixed textScaleFactor", regex: /textScale(?:Factor:\s*1(?:\.0)?\b|r:\s*TextScaler\.noScaling)/, fileFilter: DART, claims: ["larger-text"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "disableAnimations check", regex: /disableAnimations/, fileFilter: DART, claims: ["reduced-motion"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "highContrast check", regex: /highContrast/, fileFilter: DART, claims: ["sufficient-contrast"] },
  { category: "foundations", subcategory: "accessibility", type: "positive", pattern: "boldText check", regex: /\bboldText/, fileFilter: DART, claims: ["larger-text"] },
```

3c. Add to `SERIOUS_CONCERNS` (these outright disable a system accessibility feature):

```ts
  "allowFontScaling false",
  "fixed textScaleFactor",
```

- [ ] **Step 4: Run tests, sync, commit**

```bash
cd packages/hig-doctor/src-termcast && bun test src/patterns.test.ts && bun run typecheck
```
Expected: ALL PASS including `rule count is exactly 380`.

```bash
npm run sync:audit-patterns && npm run test:audit-sync
git add packages/hig-doctor/src-termcast/src/patterns.ts packages/hig-doctor/src-termcast/src/patterns.test.ts website/lib/audit/patterns.ts
git commit -m "feat(audit): add React Native and Flutter Nutrition Label evidence rules"
```

---

### Task 4: Scanner collects doc files (README + fastlane metadata)

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/scanner.ts`
- Modify: `packages/hig-doctor/src-termcast/src/scanner.test.ts`

**Interfaces:**
- Produces: `ScanResult` gains `docFiles: ScannedFile[]` — README files (`README.md`/`README.txt`, any case, any directory) and `.txt` files under any `fastlane/metadata/` path. Used by Task 6/8.

- [ ] **Step 1: Write the failing test**

Append to `scanner.test.ts` (uses only `node:fs/promises` + `node:os`, independent of existing helpers):

```ts
import { mkdtemp, mkdir, writeFile as fsWriteFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";

describe("scanProject — doc files", () => {
  test("collects README and fastlane metadata, not other markdown", async () => {
    const dir = await mkdtemp(pjoin(tmpdir(), "hig-scan-"));
    try {
      await fsWriteFile(pjoin(dir, "README.md"), "# App\nSupports VoiceOver.");
      await fsWriteFile(pjoin(dir, "CHANGELOG.md"), "# 1.0");
      await mkdir(pjoin(dir, "fastlane", "metadata", "en-US"), { recursive: true });
      await fsWriteFile(pjoin(dir, "fastlane", "metadata", "en-US", "description.txt"), "Fully supports Dynamic Type.");
      await fsWriteFile(pjoin(dir, "App.swift"), "import SwiftUI");
      const result = await scanProject(dir);
      const docPaths = result.docFiles.map(f => f.relativePath).sort();
      expect(docPaths).toEqual(["README.md", pjoin("fastlane", "metadata", "en-US", "description.txt")].sort());
      expect(result.codeFiles.some(f => f.relativePath === "App.swift")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

(If `scanner.test.ts` already imports `scanProject`/`describe`/`test`/`expect`, reuse those imports rather than duplicating them.)

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/hig-doctor/src-termcast && bun test src/scanner.test.ts
```
Expected: FAIL — `docFiles` does not exist on `ScanResult`.

- [ ] **Step 3: Implement**

In `scanner.ts`:

3a. Add to `ScanResult` after `markupFiles`:

```ts
  // App-copy documents scanned for stated accessibility claims (README,
  // App Store metadata). Not run through detectPatterns.
  docFiles: ScannedFile[];
```

3b. In `scanProject`'s initial `result` literal, add `docFiles: [],` after `markupFiles: [],`.

3c. In `walkDir`'s file branch, after the `const wantMarkup = ...` line, add:

```ts
      const posixRel = relPath.split(sep).join("/").toLowerCase();
      const isDoc =
        /^readme\.(md|txt)$/i.test(entry.name) ||
        (posixRel.includes("fastlane/metadata/") && ext === ".txt");
```

Change the skip condition to `if (!isConfig && !wantCode && !wantStyle && !wantMarkup && !isDoc) continue;` and add a final branch after the markup one:

```ts
      } else if (isDoc) {
        result.docFiles.push(file);
      }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/hig-doctor/src-termcast && bun test src/scanner.test.ts && bun run typecheck
```
Expected: PASS (typecheck may flag `audit.ts` consumers only if you changed signatures — you haven't).

- [ ] **Step 5: Commit**

```bash
git add packages/hig-doctor/src-termcast/src/scanner.ts packages/hig-doctor/src-termcast/src/scanner.test.ts
git commit -m "feat(audit): collect README and fastlane metadata as doc files"
```

---

### Task 5: Claims module core — categories, types, config loader

**Files:**
- Create: `packages/hig-doctor/src-termcast/src/claims.ts`
- Create: `packages/hig-doctor/src-termcast/src/claims.test.ts`

**Interfaces:**
- Consumes: `NutritionLabel`, `PatternMatch`, `Severity` from `./patterns`; `Framework`, `ScannedFile` from `./scanner`.
- Produces (exact, used by Tasks 6–10):

```ts
export const CLAIMS_CONFIG_RELPATH = ".hig-doctor/accessibility-claims.json";
export class ClaimsConfigError extends Error {}
export interface ClaimCategoryMeta { id: NutritionLabel; label: string; criterion: string; helpUrl: string; platformNote?: string; }
export const CLAIM_CATEGORIES: readonly ClaimCategoryMeta[];        // all 9, fixed order below
export const NUTRITION_LABEL_IDS: readonly NutritionLabel[];        // derived from CLAIM_CATEGORIES
export const APP_STORE_FRAMEWORKS: ReadonlySet<Framework>;          // swiftui, uikit, react-native, flutter
export interface DeclaredClaims { claims: NutritionLabel[]; path: string; }
export async function loadDeclaredClaims(directory: string): Promise<DeclaredClaims | null>;
export const CLAIMS_DISCLAIMER: string;                             // the verbatim disclaimer from Global Constraints
```

- [ ] **Step 1: Write the failing tests**

Create `packages/hig-doctor/src-termcast/src/claims.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CLAIM_CATEGORIES,
  NUTRITION_LABEL_IDS,
  APP_STORE_FRAMEWORKS,
  loadDeclaredClaims,
  ClaimsConfigError,
} from "./claims";

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "hig-claims-"));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

describe("CLAIM_CATEGORIES", () => {
  test("covers all nine Nutrition Label categories in fixed order", () => {
    expect(NUTRITION_LABEL_IDS).toEqual([
      "voiceover", "voice-control", "larger-text", "dark-interface",
      "differentiate-without-color", "sufficient-contrast", "reduced-motion",
      "captions", "audio-descriptions",
    ]);
    for (const c of CLAIM_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.criterion.length).toBeGreaterThan(0);
      expect(c.helpUrl).toStartWith("https://");
    }
  });
  test("App Store framework set", () => {
    expect([...APP_STORE_FRAMEWORKS].sort()).toEqual(["flutter", "react-native", "swiftui", "uikit"]);
  });
});

describe("loadDeclaredClaims", () => {
  test("returns null when config missing", async () => {
    await withTempDir(async dir => {
      expect(await loadDeclaredClaims(dir)).toBeNull();
    });
  });
  test("loads and dedupes valid claims", async () => {
    await withTempDir(async dir => {
      await mkdir(join(dir, ".hig-doctor"));
      await writeFile(join(dir, ".hig-doctor", "accessibility-claims.json"), JSON.stringify({ claims: ["voiceover", "larger-text", "voiceover"] }));
      const result = await loadDeclaredClaims(dir);
      expect(result?.claims).toEqual(["voiceover", "larger-text"]);
      expect(result?.path).toBe(join(dir, ".hig-doctor", "accessibility-claims.json"));
    });
  });
  test("throws ClaimsConfigError on invalid JSON", async () => {
    await withTempDir(async dir => {
      await mkdir(join(dir, ".hig-doctor"));
      await writeFile(join(dir, ".hig-doctor", "accessibility-claims.json"), "{not json");
      expect(loadDeclaredClaims(dir)).rejects.toThrow(ClaimsConfigError);
    });
  });
  test("throws ClaimsConfigError on unknown ids, naming valid ones", async () => {
    await withTempDir(async dir => {
      await mkdir(join(dir, ".hig-doctor"));
      await writeFile(join(dir, ".hig-doctor", "accessibility-claims.json"), JSON.stringify({ claims: ["voice-over"] }));
      expect(loadDeclaredClaims(dir)).rejects.toThrow(/voice-over.*Valid ids/s);
    });
  });
  test("throws ClaimsConfigError when claims is not a string array", async () => {
    await withTempDir(async dir => {
      await mkdir(join(dir, ".hig-doctor"));
      await writeFile(join(dir, ".hig-doctor", "accessibility-claims.json"), JSON.stringify({ claims: "voiceover" }));
      expect(loadDeclaredClaims(dir)).rejects.toThrow(ClaimsConfigError);
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/hig-doctor/src-termcast && bun test src/claims.test.ts
```
Expected: FAIL — module `./claims` not found.

- [ ] **Step 3: Implement**

Create `packages/hig-doctor/src-termcast/src/claims.ts`:

```ts
// claims.ts — Accessibility Nutrition Label claim evaluation.
// Aggregates claim-tagged pattern matches, declared claims (config file), and
// copy-stated claims (README/App Store metadata) into per-category readiness
// signals. Signals are heuristics, never certification — see CLAIMS_DISCLAIMER.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NutritionLabel, PatternMatch, Severity } from "./patterns";
import type { Framework, ScannedFile } from "./scanner";

export const CLAIMS_CONFIG_RELPATH = ".hig-doctor/accessibility-claims.json";

export const CLAIMS_DISCLAIMER =
  "Readiness signals are heuristics from static code analysis — they are not certification. " +
  "Apple requires that all common tasks be completable with each feature; verify manually with " +
  "Accessibility Inspector and assistive technologies before declaring support in App Store Connect.";

export class ClaimsConfigError extends Error {}

export interface ClaimCategoryMeta {
  id: NutritionLabel;
  label: string;
  criterion: string; // Apple's evaluation bar, paraphrased
  helpUrl: string;
  platformNote?: string;
}

const HELP_BASE = "https://developer.apple.com/help/app-store-connect/manage-app-accessibility/";

export const CLAIM_CATEGORIES: readonly ClaimCategoryMeta[] = [
  { id: "voiceover", label: "VoiceOver", criterion: "All common tasks are completable with the screen reader; all content is perceivable via the accessibility tree.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels" },
  { id: "voice-control", label: "Voice Control", criterion: "All common tasks are completable by voice (tap, swipe, type). Relies on the same element labeling as VoiceOver.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels", platformNote: "Not available on tvOS or watchOS." },
  { id: "larger-text", label: "Larger Text", criterion: "Text scales to at least 200% and layouts adapt (Dynamic Type or equivalent).", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels", platformNote: "Not available on macOS." },
  { id: "dark-interface", label: "Dark Interface", criterion: "A dark color scheme applies to all screens, menus, and controls.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels" },
  { id: "differentiate-without-color", label: "Differentiate Without Color Alone", criterion: "Key information uses shapes or text in addition to (or instead of) color.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels" },
  { id: "sufficient-contrast", label: "Sufficient Contrast", criterion: "Text and iconography meet WCAG contrast ratios against their backgrounds.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels" },
  { id: "reduced-motion", label: "Reduced Motion", criterion: "Motion that can cause discomfort is removable or reduced, honoring the system setting.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels" },
  { id: "captions", label: "Captions", criterion: "All video and audio-only content offers complete, time-synchronized captions.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels" },
  { id: "audio-descriptions", label: "Audio Descriptions", criterion: "Video content offers time-synchronized narration of important visual information.", helpUrl: HELP_BASE + "overview-of-accessibility-nutrition-labels" },
];

export const NUTRITION_LABEL_IDS: readonly NutritionLabel[] = CLAIM_CATEGORIES.map(c => c.id);

// Frameworks that ship to the App Store, where Nutrition Labels apply.
export const APP_STORE_FRAMEWORKS: ReadonlySet<Framework> = new Set([
  "swiftui", "uikit", "react-native", "flutter",
]);

export interface DeclaredClaims {
  claims: NutritionLabel[];
  path: string;
}

// Reads .hig-doctor/accessibility-claims.json from the audited project.
// Missing file → null (not an error). Malformed content → ClaimsConfigError.
export async function loadDeclaredClaims(directory: string): Promise<DeclaredClaims | null> {
  const path = join(directory, ".hig-doctor", "accessibility-claims.json");
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ClaimsConfigError(`${CLAIMS_CONFIG_RELPATH} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const claimsValue = (parsed as { claims?: unknown })?.claims;
  if (!Array.isArray(claimsValue) || claimsValue.some(v => typeof v !== "string")) {
    throw new ClaimsConfigError(`${CLAIMS_CONFIG_RELPATH} must be an object with a "claims" array of strings, e.g. {"claims": ["voiceover", "larger-text"]}`);
  }
  const valid = new Set<string>(NUTRITION_LABEL_IDS);
  const unknown = claimsValue.filter(v => !valid.has(v as string));
  if (unknown.length > 0) {
    throw new ClaimsConfigError(`${CLAIMS_CONFIG_RELPATH} contains unknown claim id(s): ${unknown.join(", ")}. Valid ids: ${NUTRITION_LABEL_IDS.join(", ")}`);
  }
  const deduped = [...new Set(claimsValue as NutritionLabel[])];
  return { claims: deduped, path };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/hig-doctor/src-termcast && bun test src/claims.test.ts && bun run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/hig-doctor/src-termcast/src/claims.ts packages/hig-doctor/src-termcast/src/claims.test.ts
git commit -m "feat(audit): add Nutrition Label category metadata and claims config loader"
```

---

### Task 6: Copy-claim extractor

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/claims.ts`
- Modify: `packages/hig-doctor/src-termcast/src/claims.test.ts`

**Interfaces:**
- Consumes: `ScannedFile` (Task 4's `docFiles` are the intended input).
- Produces:

```ts
export interface StatedClaim { category: NutritionLabel; file: string; line: number; phrase: string; }
export function extractStatedClaims(docFiles: ScannedFile[]): StatedClaim[];
```
One `StatedClaim` per (category, file) — first matching line wins; a file mentioning VoiceOver five times yields one stated claim.

- [ ] **Step 1: Write the failing tests**

Append to `claims.test.ts`:

```ts
import { extractStatedClaims } from "./claims";

describe("extractStatedClaims", () => {
  const doc = (relativePath: string, content: string) => ({ relativePath, absolutePath: "/x/" + relativePath, content });
  test("finds category phrases with file and line", () => {
    const claims = extractStatedClaims([doc("README.md", "# App\n\nFull VoiceOver support and Dynamic Type.\nWorks in Dark Mode.")]);
    const ids = claims.map(c => c.category).sort();
    expect(ids).toEqual(["dark-interface", "larger-text", "voiceover"]);
    const vo = claims.find(c => c.category === "voiceover")!;
    expect(vo.file).toBe("README.md");
    expect(vo.line).toBe(3);
    expect(vo.phrase.toLowerCase()).toContain("voiceover");
  });
  test("dedupes repeated mentions within a file", () => {
    const claims = extractStatedClaims([doc("README.md", "VoiceOver.\nVoiceOver again.\nvoice over!")]);
    expect(claims.filter(c => c.category === "voiceover").length).toBe(1);
  });
  test("reports the same category from different files separately", () => {
    const claims = extractStatedClaims([
      doc("README.md", "Supports captions."),
      doc("fastlane/metadata/en-US/description.txt", "Closed captions available."),
    ]);
    expect(claims.filter(c => c.category === "captions").length).toBe(2);
  });
  test("empty input yields empty output", () => {
    expect(extractStatedClaims([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/hig-doctor/src-termcast && bun test src/claims.test.ts
```
Expected: new describe FAILS (`extractStatedClaims` not exported).

- [ ] **Step 3: Implement**

Append to `claims.ts`:

```ts
export interface StatedClaim {
  category: NutritionLabel;
  file: string;
  line: number;
  phrase: string;
}

// Phrases in app copy that read as accessibility support claims. Deliberately
// conservative: generic wording ("fully accessible") maps to no category.
const CLAIM_PHRASES: ReadonlyArray<{ id: NutritionLabel; regex: RegExp }> = [
  { id: "voiceover", regex: /\bvoice\s*-?\s*over\b/i },
  { id: "voice-control", regex: /\bvoice\s*control\b/i },
  { id: "larger-text", regex: /\bdynamic\s*type\b|\blarger?\s*text\b|\b(?:text|font)\s*scaling\b/i },
  { id: "dark-interface", regex: /\bdark\s*(?:mode|theme|interface)\b/i },
  { id: "differentiate-without-color", regex: /\bcolor[-\s]?blind|\bwithout\s+color\s+alone\b/i },
  { id: "sufficient-contrast", regex: /\bwcag\b|\bhigh[-\s]contrast\b|\bcontrast\s*ratio\b|\bsufficient\s*contrast\b/i },
  { id: "reduced-motion", regex: /\breduced?\s*motion\b/i },
  { id: "captions", regex: /\b(?:closed\s*)?captions?\b|\bsubtitles\b/i },
  { id: "audio-descriptions", regex: /\baudio\s*descriptions?\b/i },
];

// One stated claim per (category, file): the first line that mentions it.
export function extractStatedClaims(docFiles: ScannedFile[]): StatedClaim[] {
  const stated: StatedClaim[] = [];
  for (const file of docFiles) {
    const lines = file.content.split("\n");
    const seen = new Set<NutritionLabel>();
    for (let i = 0; i < lines.length; i++) {
      for (const { id, regex } of CLAIM_PHRASES) {
        if (seen.has(id)) continue;
        const m = regex.exec(lines[i]);
        if (m) {
          seen.add(id);
          stated.push({ category: id, file: file.relativePath, line: i + 1, phrase: m[0] });
        }
      }
    }
  }
  return stated;
}
```

- [ ] **Step 4: Run tests, commit**

```bash
cd packages/hig-doctor/src-termcast && bun test src/claims.test.ts && bun run typecheck
git add packages/hig-doctor/src-termcast/src/claims.ts packages/hig-doctor/src-termcast/src/claims.test.ts
git commit -m "feat(audit): extract stated accessibility claims from app copy"
```

---

### Task 7: Claims evaluator

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/claims.ts`
- Modify: `packages/hig-doctor/src-termcast/src/claims.test.ts`

**Interfaces:**
- Consumes: `PatternMatch.claims` (Task 1), `StatedClaim` (Task 6), `APP_STORE_FRAMEWORKS`, `CLAIM_CATEGORIES` (Task 5).
- Produces (exact, used by Tasks 8–10):

```ts
export interface EvidenceRef { file: string; line: number; pattern: string; severity?: Severity; }
export type ReadinessSignal = "ready-signal" | "partial" | "at-risk" | "no-signal";
export interface ClaimAssessment {
  id: NutritionLabel; label: string; signal: ReadinessSignal;
  declared: boolean; stated: StatedClaim[];
  supporting: EvidenceRef[]; contradicting: EvidenceRef[];
  criterion: string; platformNote?: string; notes: string[];
}
export interface ClaimsEvaluation {
  applicable: boolean;                 // an App-Store-shippable framework was detected
  configPath: string | null;
  declaredClaims: NutritionLabel[];
  assessments: ClaimAssessment[];      // always all 9, CLAIM_CATEGORIES order
}
export function evaluateClaims(input: {
  matches: PatternMatch[]; frameworks: Framework[];
  declared: NutritionLabel[]; configPath: string | null; stated: StatedClaim[];
}): ClaimsEvaluation;
```

**Signal rules (from the spec, exact):** Let S = supporting evidence, C = contradicting evidence, claimed = declared OR stated non-empty.
1. S empty and C empty → `no-signal` unless claimed, then `at-risk`.
2. S empty and C non-empty → `at-risk`.
3. Any critical-severity contradiction → `at-risk`.
4. S non-empty, C non-empty, no critical → `partial`.
5. S non-empty, C empty → `ready-signal`.

**Notes generated (exact strings):**
- declared and signal is `at-risk` → `Declared in config but at risk`
- each stated claim not declared → `` Stated in <file>:<line> ("<phrase>") but not declared in .hig-doctor/accessibility-claims.json ``
- stated non-empty and S empty → `Stated in app copy with no supporting code evidence`

- [ ] **Step 1: Write the failing tests**

Append to `claims.test.ts`:

```ts
import { evaluateClaims, type ClaimsEvaluation } from "./claims";
import type { PatternMatch } from "./patterns";

const pm = (over: Partial<PatternMatch> & { claims: PatternMatch["claims"] }): PatternMatch => ({
  category: "foundations", subcategory: "accessibility", type: "positive",
  pattern: "accessibilityLabel", line: 1, lineContent: "x", file: "View.swift",
  ...over,
});

describe("evaluateClaims", () => {
  test("always returns all nine assessments in category order", () => {
    const r = evaluateClaims({ matches: [], frameworks: ["swiftui"], declared: [], configPath: null, stated: [] });
    expect(r.assessments.map(a => a.id)).toEqual([...NUTRITION_LABEL_IDS]);
    expect(r.applicable).toBe(true);
    for (const a of r.assessments) expect(a.signal).toBe("no-signal");
  });
  test("not applicable without an App-Store-shippable framework", () => {
    const r = evaluateClaims({ matches: [], frameworks: ["nextjs"], declared: [], configPath: null, stated: [] });
    expect(r.applicable).toBe(false);
  });
  test("support without contradiction → ready-signal", () => {
    const r = evaluateClaims({
      matches: [pm({ claims: ["voiceover", "voice-control"] })],
      frameworks: ["swiftui"], declared: [], configPath: null, stated: [],
    });
    expect(r.assessments.find(a => a.id === "voiceover")?.signal).toBe("ready-signal");
    expect(r.assessments.find(a => a.id === "voice-control")?.signal).toBe("ready-signal");
  });
  test("support plus non-critical contradiction → partial", () => {
    const r = evaluateClaims({
      matches: [
        pm({ claims: ["larger-text"] }),
        pm({ type: "concern", severity: "moderate", pattern: "hardcodedFontSize", claims: ["larger-text"] }),
      ],
      frameworks: ["swiftui"], declared: [], configPath: null, stated: [],
    });
    expect(r.assessments.find(a => a.id === "larger-text")?.signal).toBe("partial");
  });
  test("critical contradiction → at-risk even with support", () => {
    const r = evaluateClaims({
      matches: [
        pm({ claims: ["voiceover"] }),
        pm({ type: "concern", severity: "critical", pattern: "missing alt", claims: ["voiceover"] }),
      ],
      frameworks: ["swiftui"], declared: [], configPath: null, stated: [],
    });
    expect(r.assessments.find(a => a.id === "voiceover")?.signal).toBe("at-risk");
  });
  test("declared claim with zero support → at-risk with note", () => {
    const r = evaluateClaims({ matches: [], frameworks: ["swiftui"], declared: ["captions"], configPath: "/p/.hig-doctor/accessibility-claims.json", stated: [] });
    const a = r.assessments.find(x => x.id === "captions")!;
    expect(a.signal).toBe("at-risk");
    expect(a.declared).toBe(true);
    expect(a.notes).toContain("Declared in config but at risk");
  });
  test("stated-but-not-declared claim gets a mismatch note", () => {
    const r = evaluateClaims({
      matches: [pm({ claims: ["voiceover"] })],
      frameworks: ["swiftui"], declared: [], configPath: null,
      stated: [{ category: "voiceover", file: "README.md", line: 3, phrase: "VoiceOver" }],
    });
    const a = r.assessments.find(x => x.id === "voiceover")!;
    expect(a.notes).toContain('Stated in README.md:3 ("VoiceOver") but not declared in .hig-doctor/accessibility-claims.json');
  });
  test("stated claim with no code evidence → at-risk with note", () => {
    const r = evaluateClaims({
      matches: [], frameworks: ["swiftui"], declared: [], configPath: null,
      stated: [{ category: "reduced-motion", file: "README.md", line: 1, phrase: "reduce motion" }],
    });
    const a = r.assessments.find(x => x.id === "reduced-motion")!;
    expect(a.signal).toBe("at-risk");
    expect(a.notes).toContain("Stated in app copy with no supporting code evidence");
  });
  test("only contradictions, unclaimed → at-risk", () => {
    const r = evaluateClaims({
      matches: [pm({ type: "concern", severity: "serious", pattern: "allowFontScaling false", claims: ["larger-text"] })],
      frameworks: ["react-native"], declared: [], configPath: null, stated: [],
    });
    expect(r.assessments.find(a => a.id === "larger-text")?.signal).toBe("at-risk");
  });
  test("pattern-type matches are ignored as evidence", () => {
    const r = evaluateClaims({
      matches: [pm({ type: "pattern", claims: ["voiceover"] })],
      frameworks: ["swiftui"], declared: [], configPath: null, stated: [],
    });
    expect(r.assessments.find(a => a.id === "voiceover")?.signal).toBe("no-signal");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/hig-doctor/src-termcast && bun test src/claims.test.ts
```
Expected: new describe FAILS (`evaluateClaims` not exported).

- [ ] **Step 3: Implement**

Append to `claims.ts`:

```ts
export interface EvidenceRef {
  file: string;
  line: number;
  pattern: string;
  severity?: Severity;
}

export type ReadinessSignal = "ready-signal" | "partial" | "at-risk" | "no-signal";

export interface ClaimAssessment {
  id: NutritionLabel;
  label: string;
  signal: ReadinessSignal;
  declared: boolean;
  stated: StatedClaim[];
  supporting: EvidenceRef[];
  contradicting: EvidenceRef[];
  criterion: string;
  platformNote?: string;
  notes: string[];
}

export interface ClaimsEvaluation {
  applicable: boolean;
  configPath: string | null;
  declaredClaims: NutritionLabel[];
  assessments: ClaimAssessment[];
}

export function evaluateClaims(input: {
  matches: PatternMatch[];
  frameworks: Framework[];
  declared: NutritionLabel[];
  configPath: string | null;
  stated: StatedClaim[];
}): ClaimsEvaluation {
  const applicable = input.frameworks.some(f => APP_STORE_FRAMEWORKS.has(f));

  // Bucket evidence once. "pattern"-type matches are inventory, not evidence.
  const supporting = new Map<NutritionLabel, EvidenceRef[]>();
  const contradicting = new Map<NutritionLabel, EvidenceRef[]>();
  for (const m of input.matches) {
    if (!m.claims || (m.type !== "positive" && m.type !== "concern")) continue;
    const bucket = m.type === "positive" ? supporting : contradicting;
    for (const id of m.claims) {
      if (!bucket.has(id)) bucket.set(id, []);
      bucket.get(id)!.push({ file: m.file, line: m.line, pattern: m.pattern, severity: m.severity });
    }
  }

  const assessments: ClaimAssessment[] = CLAIM_CATEGORIES.map(meta => {
    const support = supporting.get(meta.id) ?? [];
    const contra = contradicting.get(meta.id) ?? [];
    const declared = input.declared.includes(meta.id);
    const stated = input.stated.filter(s => s.category === meta.id);
    const claimed = declared || stated.length > 0;
    const hasCritical = contra.some(e => e.severity === "critical");

    let signal: ReadinessSignal;
    if (support.length === 0 && contra.length === 0) signal = claimed ? "at-risk" : "no-signal";
    else if (support.length === 0 || hasCritical) signal = "at-risk";
    else if (contra.length > 0) signal = "partial";
    else signal = "ready-signal";

    const notes: string[] = [];
    if (declared && signal === "at-risk") notes.push("Declared in config but at risk");
    for (const s of stated) {
      if (!declared) notes.push(`Stated in ${s.file}:${s.line} ("${s.phrase}") but not declared in ${CLAIMS_CONFIG_RELPATH}`);
    }
    if (stated.length > 0 && support.length === 0) notes.push("Stated in app copy with no supporting code evidence");

    return {
      id: meta.id,
      label: meta.label,
      signal,
      declared,
      stated,
      supporting: support,
      contradicting: contra,
      criterion: meta.criterion,
      ...(meta.platformNote ? { platformNote: meta.platformNote } : {}),
      notes,
    };
  });

  return { applicable, configPath: input.configPath, declaredClaims: input.declared, assessments };
}
```

- [ ] **Step 4: Run all claims tests, commit**

```bash
cd packages/hig-doctor/src-termcast && bun test src/claims.test.ts && bun run typecheck
git add packages/hig-doctor/src-termcast/src/claims.ts packages/hig-doctor/src-termcast/src/claims.test.ts
git commit -m "feat(audit): evaluate Nutrition Label claim readiness signals"
```

---

### Task 8: Wire claims into the audit pipeline and markdown report

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/audit.ts`
- Modify: `packages/hig-doctor/src-termcast/src/audit-generator.ts`
- Modify: `packages/hig-doctor/src-termcast/src/audit-generator.test.ts`
- Modify: `packages/hig-doctor/src-termcast/src/audit.test.ts`

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces (used by Tasks 9–10):
  - `AuditResult` gains `claims: ClaimsEvaluation`.
  - `audit()` throws `ClaimsConfigError` (propagated, not caught) on malformed config.
  - `generateAuditMarkdown(scanResult, categories, skillsDir, skillContents?, claims?)` — optional 5th param; when present, a `## Accessibility Nutrition Label Readiness` section is inserted immediately after the Quick stats line.
  - `export function renderClaimsSection(claims: ClaimsEvaluation): string` in `audit-generator.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `audit-generator.test.ts` (reuse its existing imports of `describe/test/expect`; add `renderClaimsSection` to the module import):

```ts
import { renderClaimsSection } from "./audit-generator";
import type { ClaimsEvaluation } from "./claims";

const evaluation: ClaimsEvaluation = {
  applicable: true,
  configPath: "/proj/.hig-doctor/accessibility-claims.json",
  declaredClaims: ["voiceover"],
  assessments: [
    {
      id: "voiceover", label: "VoiceOver", signal: "partial", declared: true,
      stated: [{ category: "voiceover", file: "README.md", line: 3, phrase: "VoiceOver" }],
      supporting: [{ file: "V.swift", line: 10, pattern: "accessibilityLabel" }],
      contradicting: [{ file: "V.swift", line: 22, pattern: "Image without a11y", severity: "moderate" }],
      criterion: "All common tasks are completable with the screen reader; all content is perceivable via the accessibility tree.",
      notes: [],
    },
    {
      id: "captions", label: "Captions", signal: "no-signal", declared: false,
      stated: [], supporting: [], contradicting: [],
      criterion: "All video and audio-only content offers complete, time-synchronized captions.",
      notes: [],
    },
  ],
};

describe("renderClaimsSection", () => {
  test("renders header, disclaimer, table row per assessment, and evidence refs", () => {
    const md = renderClaimsSection(evaluation);
    expect(md).toContain("## Accessibility Nutrition Label Readiness");
    expect(md).toContain("not certification");
    expect(md).toContain("| VoiceOver | partial | yes | 1 | 1 |");
    expect(md).toContain("| Captions | no-signal | no | 0 | 0 |");
    expect(md).toContain("V.swift:10");
    expect(md).toContain("V.swift:22");
  });
  test("renders the not-applicable note when no App Store framework", () => {
    const md = renderClaimsSection({ ...evaluation, applicable: false });
    expect(md).toContain("no App-Store-shippable framework detected");
    expect(md).not.toContain("| VoiceOver |");
  });
});
```

Append to `audit.test.ts` (it already builds fixture projects with temp dirs — follow its existing fixture helper; if none fits, use the mkdtemp pattern from Task 4's test):

```ts
test("audit result includes claims evaluation with declared claims", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hig-audit-claims-"));
  try {
    await mkdir(join(dir, ".hig-doctor"), { recursive: true });
    await writeFile(join(dir, ".hig-doctor", "accessibility-claims.json"), JSON.stringify({ claims: ["voiceover"] }));
    await writeFile(join(dir, "README.md"), "Supports VoiceOver and Dark Mode.");
    await writeFile(join(dir, "App.swift"), `import SwiftUI\nText("hi").accessibilityLabel("hi")`);
    const result = await audit(dir);
    expect(result.claims.applicable).toBe(true);
    expect(result.claims.declaredClaims).toEqual(["voiceover"]);
    const vo = result.claims.assessments.find(a => a.id === "voiceover")!;
    expect(vo.declared).toBe(true);
    expect(vo.supporting.length).toBeGreaterThan(0);
    expect(result.markdown).toContain("## Accessibility Nutrition Label Readiness");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("audit throws ClaimsConfigError on malformed claims config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hig-audit-claims-bad-"));
  try {
    await mkdir(join(dir, ".hig-doctor"), { recursive: true });
    await writeFile(join(dir, ".hig-doctor", "accessibility-claims.json"), "{nope");
    await writeFile(join(dir, "App.swift"), "import SwiftUI");
    expect(audit(dir)).rejects.toThrow(ClaimsConfigError);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

(Add the needed imports at the top of `audit.test.ts`: `ClaimsConfigError` from `./claims`; `mkdtemp/mkdir/writeFile/rm` from `node:fs/promises`; `tmpdir` from `node:os`; `join` from `node:path` — skipping any already imported.)

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/hig-doctor/src-termcast && bun test src/audit-generator.test.ts src/audit.test.ts
```
Expected: new tests FAIL (no `renderClaimsSection`, no `claims` on result).

- [ ] **Step 3: Implement `renderClaimsSection`**

In `audit-generator.ts`, add the import and function:

```ts
import { CLAIMS_DISCLAIMER, type ClaimsEvaluation } from "./claims";
```

```ts
export function renderClaimsSection(claims: ClaimsEvaluation): string {
  const lines: string[] = [];
  lines.push("## Accessibility Nutrition Label Readiness");
  lines.push("");
  lines.push(`> ${CLAIMS_DISCLAIMER}`);
  lines.push("");
  if (!claims.applicable) {
    lines.push("*Nutrition Labels apply to App Store apps — no App-Store-shippable framework detected (SwiftUI, UIKit, React Native, Flutter). Skipping readiness assessment.*");
    lines.push("");
    return lines.join("\n");
  }
  if (claims.configPath) {
    lines.push(`Declared claims (from \`${CLAIMS_CONFIG_RELPATH}\`): ${claims.declaredClaims.length > 0 ? claims.declaredClaims.join(", ") : "none"}`);
  } else {
    lines.push(`No \`${CLAIMS_CONFIG_RELPATH}\` found — assessing readiness for all categories without declarations.`);
  }
  lines.push("");
  lines.push("| Feature | Signal | Declared | Supporting | Contradicting |");
  lines.push("|---------|--------|----------|------------|---------------|");
  for (const a of claims.assessments) {
    lines.push(`| ${a.label} | ${a.signal} | ${a.declared ? "yes" : "no"} | ${a.supporting.length} | ${a.contradicting.length} |`);
  }
  lines.push("");
  for (const a of claims.assessments) {
    if (a.signal === "no-signal" && a.notes.length === 0) continue;
    lines.push(`### ${a.label} — ${a.signal}`);
    lines.push("");
    lines.push(`*Apple's bar: ${a.criterion}*${a.platformNote ? ` (${a.platformNote})` : ""}`);
    lines.push("");
    if (a.supporting.length > 0) {
      lines.push(`Supporting evidence (${a.supporting.length}):`);
      for (const e of a.supporting.slice(0, 5)) lines.push(`- \`${e.file}:${e.line}\` — ${e.pattern}`);
      if (a.supporting.length > 5) lines.push(`- ... and ${a.supporting.length - 5} more`);
      lines.push("");
    }
    if (a.contradicting.length > 0) {
      lines.push(`Contradicting evidence (${a.contradicting.length}):`);
      for (const e of a.contradicting.slice(0, 5)) lines.push(`- \`${e.file}:${e.line}\` — ${e.pattern}${e.severity ? ` (${e.severity})` : ""}`);
      if (a.contradicting.length > 5) lines.push(`- ... and ${a.contradicting.length - 5} more`);
      lines.push("");
    }
    for (const note of a.notes) lines.push(`- **Note:** ${note}`);
    if (a.notes.length > 0) lines.push("");
  }
  return lines.join("\n");
}
```

Also import `CLAIMS_CONFIG_RELPATH` (extend the import above). In `generateAuditMarkdown`, change the signature to add `claims?: ClaimsEvaluation` as the 5th parameter, and immediately after the `lines.push("")` that follows the Quick stats line, insert:

```ts
  if (claims) {
    lines.push(renderClaimsSection(claims));
    lines.push("");
  }
```

- [ ] **Step 4: Implement the pipeline step**

In `audit.ts`:

```ts
import { loadDeclaredClaims, extractStatedClaims, evaluateClaims, type ClaimsEvaluation } from "./claims";
```

Add `claims: ClaimsEvaluation;` to `AuditResult`. In `audit()`, after the categorize step (step 3) insert:

```ts
  // 3b. Evaluate Nutrition Label claim readiness (throws ClaimsConfigError on
  // a malformed .hig-doctor/accessibility-claims.json — callers surface it as
  // a usage error, not a crash).
  const declared = await loadDeclaredClaims(resolvedDir);
  const stated = extractStatedClaims(scanResult.docFiles);
  const claims = evaluateClaims({
    matches: allMatches,
    frameworks: scanResult.frameworks,
    declared: declared?.claims ?? [],
    configPath: declared?.path ?? null,
    stated,
  });
```

Pass `claims` as the 5th argument to `generateAuditMarkdown(...)` and add `claims` to the returned object.

- [ ] **Step 5: Run tests, commit**

```bash
cd packages/hig-doctor/src-termcast && bun test && bun run typecheck
```
Expected: ALL suites PASS.

```bash
git add packages/hig-doctor/src-termcast/src/audit.ts packages/hig-doctor/src-termcast/src/audit-generator.ts packages/hig-doctor/src-termcast/src/audit-generator.test.ts packages/hig-doctor/src-termcast/src/audit.test.ts
git commit -m "feat(audit): evaluate and report Nutrition Label readiness in the audit pipeline"
```

---

### Task 9: CLI — scoreboard, `--fail-on-claims`, JSON block

**Files:**
- Modify: `packages/hig-doctor/src-termcast/src/cli.ts`

**Interfaces:**
- Consumes: `result.claims` (Task 8), `ClaimsConfigError` from `./claims`.
- Produces (observable behavior):
  - Default summary prints a Nutrition Labels scoreboard between the Totals row and the severity interpretation.
  - `--fail-on-claims`: exit 1 when any DECLARED claim's signal is `at-risk`. Composes with `--fail-on` (either gate trips → exit 1). Applies in default, `--stdout`, `--export`, and `--json` modes.
  - `--json` output gains a top-level `claims` key (shape below). `schemaVersion` stays `1`.
  - `ClaimsConfigError` → message on stderr, exit 2.

- [ ] **Step 1: Implement (CLI is verified by behavior; the existing repo has no cli unit tests — verification is the smoke script in Step 2)**

1a. After `const failOn = parseFailOn(flags, args);` add:

```ts
  const failOnClaims = flags.has("--fail-on-claims");
```

1b. Wrap the audit call to surface config errors as usage errors:

```ts
  let result;
  try {
    result = await audit(directory, skillsDir, { exclude });
  } catch (e) {
    if (e instanceof ClaimsConfigError) {
      process.stderr.write(`\n${c.red}Error:${c.reset} ${e.message}\n`);
      process.exit(2);
    }
    throw e;
  }
  const { categories, scanResult, allMatches, markdown } = result;
```

Add the import: `import { ClaimsConfigError } from "./claims";`

1c. After the `gateTripped` line add:

```ts
  const claimsGateTripped = failOnClaims && result.claims.assessments.some(a => a.declared && a.signal === "at-risk");
  const anyGateTripped = gateTripped || claimsGateTripped;
```

Replace every `process.exit(gateTripped ? 1 : 0)` (four occurrences: stdout, export, json, default) with `process.exit(anyGateTripped ? 1 : 0)`.

1d. In the `--json` block, add after the `failOn,`/`gateTripped,` lines:

```ts
      failOnClaims,
      claimsGateTripped,
      claims: {
        applicable: result.claims.applicable,
        configPath: result.claims.configPath,
        declared: result.claims.declaredClaims,
        assessments: result.claims.assessments.map(a => ({
          id: a.id,
          label: a.label,
          signal: a.signal,
          declared: a.declared,
          stated: a.stated.map(s => ({ file: s.file, line: s.line })),
          supporting: a.supporting.length,
          contradicting: a.contradicting.length,
          examples: {
            supporting: a.supporting.slice(0, 5),
            contradicting: a.contradicting.slice(0, 5),
          },
          notes: a.notes,
        })),
      },
```

1e. In the default rich-summary mode, after the Totals row block (`process.stdout.write("\n");` NOT yet emitted — insert before the severity interpretation block) add:

```ts
  // Nutrition Label scoreboard
  process.stdout.write("\n");
  if (!result.claims.applicable) {
    process.stdout.write(`  ${c.dim}Nutrition Labels: n/a — no App-Store-shippable framework detected (SwiftUI/UIKit/React Native/Flutter).${c.reset}\n`);
  } else {
    process.stdout.write(`  ${c.bold}Accessibility Nutrition Labels${c.reset} ${c.dim}(readiness signals — verify manually before declaring)${c.reset}\n`);
    for (const a of result.claims.assessments) {
      const glyph =
        a.signal === "ready-signal" ? `${c.green}✓${c.reset}` :
        a.signal === "partial" ? `${c.yellow}◐${c.reset}` :
        a.signal === "at-risk" ? `${c.red}✗${c.reset}` :
        `${c.dim}–${c.reset}`;
      const label = a.label.length > 34 ? a.label.slice(0, 33) + "…" : a.label.padEnd(34);
      const declared = a.declared ? `  ${c.cyan}[declared]${c.reset}` : "";
      const counts = a.signal === "no-signal"
        ? `${c.dim}no signal${c.reset}`
        : `${c.green}${a.supporting.length} supporting${c.reset} · ${a.contradicting.length > 0 ? c.yellow : c.dim}${a.contradicting.length} contradicting${c.reset}`;
      process.stdout.write(`  ${glyph} ${label} ${counts}${declared}\n`);
      for (const note of a.notes) {
        process.stdout.write(`      ${c.dim}${note}${c.reset}\n`);
      }
    }
    if (failOnClaims) {
      process.stdout.write(`  ${c.dim}--fail-on-claims${c.reset} · `);
      process.stdout.write(claimsGateTripped ? `${c.red}gate tripped${c.reset}\n` : `${c.green}gate clean${c.reset}\n`);
    }
  }
```

1f. Update the `--help` text: in the Options block, after the `--fail-on` lines add:

```
  --fail-on-claims      Exit 1 if a declared Nutrition Label claim is at risk
                        ${c.dim}(declare claims in .hig-doctor/accessibility-claims.json)${c.reset}
```

and change the exit-codes line's description of `1` to `--fail-on/--fail-on-claims gate tripped`.

- [ ] **Step 2: Smoke-test all modes against a fixture**

```bash
cd packages/hig-doctor/src-termcast
FIX=$(mktemp -d)
mkdir -p "$FIX/.hig-doctor"
printf '{"claims": ["voiceover", "captions"]}' > "$FIX/.hig-doctor/accessibility-claims.json"
printf 'Supports VoiceOver and Dark Mode.' > "$FIX/README.md"
printf 'import SwiftUI\nstruct V: View { var body: some View { Text("hi").accessibilityLabel("hi") } }' > "$FIX/App.swift"
bun src/cli.ts "$FIX"                      # scoreboard renders; VoiceOver ✓/◐, Captions ✗ [declared]
bun src/cli.ts "$FIX" --json | head -60    # claims key present with 9 assessments
bun src/cli.ts "$FIX" --fail-on-claims; echo "exit=$?"   # exit=1 (captions declared, at-risk)
printf '{"claims": "voiceover"}' > "$FIX/.hig-doctor/accessibility-claims.json"
bun src/cli.ts "$FIX"; echo "exit=$?"      # clear config error, exit=2
rm -rf "$FIX"
```
Expected: as annotated. Also run the full suite: `bun test && bun run typecheck` — PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/hig-doctor/src-termcast/src/cli.ts
git commit -m "feat(cli): Nutrition Label scoreboard, --fail-on-claims gate, claims JSON"
```

---

### Task 10: MCP server surfaces claims

**Files:**
- Modify: `packages/hig-doctor/src-mcp/src/index.ts`

**Interfaces:**
- Consumes: `result.claims` from `audit()` (Task 8).
- Produces: `hig_audit` JSON summary gains a `claims` key: `{ applicable, declared, signals: Record<NutritionLabel, ReadinessSignal>, atRiskDeclared: NutritionLabel[] }`. Markdown (second content block) already carries the full readiness section via Task 8. Tool description mentions the capability.

- [ ] **Step 1: Implement**

1a. In the `hig_audit` tool description (ListTools handler), replace the final sentence with:

```
Returns severity counts (critical/serious/moderate), Accessibility Nutrition Label readiness signals (VoiceOver, Voice Control, Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, Audio Descriptions), plus a markdown report with code excerpts and HIG reference material. Declared claims are read from .hig-doctor/accessibility-claims.json in the audited project when present.
```

1b. In the `hig_audit` handler, add to the `summary` object after `gateTripped`:

```ts
      claims: {
        applicable: result.claims.applicable,
        declared: result.claims.declaredClaims,
        signals: Object.fromEntries(result.claims.assessments.map((a) => [a.id, a.signal])),
        atRiskDeclared: result.claims.assessments
          .filter((a) => a.declared && a.signal === "at-risk")
          .map((a) => a.id),
      },
```

(`ClaimsConfigError` needs no special handling here — the existing catch-all already returns tool errors as `isError` results with the message.)

- [ ] **Step 2: Verify by driving the server**

```bash
cd packages/hig-doctor/src-mcp && bun run build
FIX=$(mktemp -d)
printf 'import SwiftUI\nstruct V: View { var body: some View { Text("x").accessibilityLabel("x") } }' > "$FIX/App.swift"
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"hig_audit","arguments":{"directory":"'"$FIX"'"}}}\n' | HIG_SKILLS_DIR=/Users/davidbridge/src/hig-doctor/skills bun src/index.ts | grep -o '"claims":{[^}]*"applicable":true'
rm -rf "$FIX"
```
Expected: grep finds the claims block (non-empty output).

- [ ] **Step 3: Commit**

```bash
git add packages/hig-doctor/src-mcp/src/index.ts
git commit -m "feat(mcp): expose Nutrition Label readiness in hig_audit summary"
```

---

### Task 11: New Agent Skill `hig-accessibility-audit` + registry entries

**Files:**
- Create: `skills/hig-accessibility-audit/SKILL.md`
- Create: `skills/hig-accessibility-audit/references/nutrition-labels.md`
- Create: `skills/hig-accessibility-audit/references/claim-evidence.md`
- Modify: `VERSIONS.md` (new row + changelog entry)
- Modify: `.claude-plugin/marketplace.json` (skills array + "14 skills" → "15 skills" in both description strings)

**Interfaces:**
- Consumes: audit CLI behavior from Task 9 (referenced in prose).
- Produces: a skill passing the repo validator (required H2 sections: Key Principles, Reference Index, Output Format, Questions to Ask, Related Skills; body starts with the context-check hint; `name` matches directory; `version: 1.0.0` matching VERSIONS.md; description 1–1024 chars).

- [ ] **Step 1: Create `skills/hig-accessibility-audit/SKILL.md`** (write exactly; keep under 500 lines — this is ~90):

````markdown
---
name: hig-accessibility-audit
version: 1.0.0
description: >-
  Accessibility Nutrition Label readiness guidance for App Store apps. Use when
  the user asks "can I claim VoiceOver support," "are we ready for Accessibility
  Nutrition Labels," "check my accessibility claims," "audit accessibility," or
  mentions declaring accessibility features in App Store Connect. Interprets the
  hig-doctor audit's Nutrition Label scoreboard (VoiceOver, Voice Control,
  Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient
  Contrast, Reduced Motion, Captions, Audio Descriptions) and walks through the
  manual verification Apple requires before declaring support. For general
  accessibility design guidance, see hig-foundations. For input methods, see
  hig-inputs.
---

You are an expert in Apple accessibility and App Store Accessibility Nutrition
Labels. You help teams assess, verify, and truthfully declare which
accessibility features their app supports.

Check for `.claude/apple-design-context.md` before asking questions.
Use existing context and only ask for information not already covered.

## Key Principles

1. **Readiness signals are not certification.** Static scanning finds evidence,
   not proof. Apple's bar is that all common tasks (primary functionality,
   first launch, login, purchases, settings) are completable with each feature.
   Never advise declaring a claim on scanner output alone.
2. **Run the scanner first.** Use `hig-doctor <directory>` (or the `hig_audit`
   MCP tool) to get the Nutrition Label scoreboard: per-category signals of
   `ready-signal`, `partial`, `at-risk`, or `no-signal`.
3. **Declared claims live in config.** `.hig-doctor/accessibility-claims.json`
   (`{"claims": ["voiceover", "larger-text"]}`) records what the app intends to
   declare in App Store Connect. `--fail-on-claims` gates CI on declared claims
   that scan as at-risk.
4. **VoiceOver and Voice Control share an accessibility tree.** Labels, traits,
   and values that serve the screen reader also serve voice navigation — fix
   labeling once, verify both features separately.
5. **Contradicting evidence outranks supporting evidence.** One
   `allowFontScaling={false}` or a pinned text scale factor undermines a Larger
   Text claim regardless of how many views scale correctly.
6. **Verify with Apple's tools before declaring.** Accessibility Inspector
   audits, then hands-on passes with VoiceOver, Voice Control, and the relevant
   system settings on device.

## Reference Index

| Topic | File | Covers |
|-------|------|--------|
| Nutrition Labels overview | [references/nutrition-labels.md](references/nutrition-labels.md) | The nine categories, Apple's evaluation criteria, platform notes, App Store Connect declaration flow |
| Claim evidence and verification | [references/claim-evidence.md](references/claim-evidence.md) | Per-category code evidence the scanner detects, what static analysis cannot see, manual test checklists |

## Output Format

When assessing claim readiness, structure the response as:

1. **Scoreboard summary** — each category with its signal and one-line reason.
2. **Per-claim assessment** (for categories the user cares about) — supporting
   evidence found (file:line), contradicting evidence to fix, and the manual
   verification steps still required.
3. **Gaps to close** — concrete code changes, ordered by severity.
4. **Declaration guidance** — which claims look defensible after manual
   verification, which to hold back, citing Apple's common-tasks bar.

Cite the specific HIG topic when giving design guidance (e.g. "Per Apple's HIG
on accessibility..."). Distinguish requirements ("must") from recommendations
("should", "consider").

## Questions to Ask

Before giving advice, ask (unless already answered by project context):

1. Which platforms does the app target? (Voice Control is unavailable on tvOS
   and watchOS; Larger Text is unavailable on macOS.)
2. Which Nutrition Label features do you intend to declare in App Store
   Connect?
3. Does the app play video or audio content? (Captions and Audio Descriptions
   only apply when it does.)
4. Have you run the hig-doctor audit, and can you share the scoreboard output?
5. Have you done a manual pass with VoiceOver or Accessibility Inspector yet?

## Related Skills

- **hig-foundations** — accessibility design foundations, color, typography,
  dark mode (references/accessibility.md there covers the full HIG topic)
- **hig-inputs** — gestures, keyboards, and alternative input methods
- **hig-technologies** — Apple technology integrations that interact with
  accessibility features
- **hig-project-context** — establishes the shared project context this skill
  reads before asking questions
````

- [ ] **Step 2: Create `skills/hig-accessibility-audit/references/nutrition-labels.md`** (our own summary — no Apple prose reproduction):

````markdown
# Accessibility Nutrition Labels

Accessibility Nutrition Labels are App Store declarations of which
accessibility features an app supports. Developers declare them in App Store
Connect; the declarations appear on the app's product page. Declaring support
is a claim of fact: Apple's bar is that **all common tasks** — primary app
functionality, first launch, login, purchases, and settings — are completable
using that feature.

Canonical documentation: [Overview of Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels)
(App Store Connect help).

## The nine categories

| Category | id (scanner) | A user can... | Platform notes |
|----------|--------------|---------------|----------------|
| VoiceOver | `voiceover` | Navigate and use the app with the screen reader (gestures, keyboard, braille, speech output) | |
| Voice Control | `voice-control` | Navigate and interact entirely by voice (tap, swipe, type) | Not on tvOS or Apple Watch |
| Larger Text | `larger-text` | Scale text to 200% or more with layouts adapting | Not on Mac |
| Dark Interface | `dark-interface` | Use a dark color scheme across all screens, menus, and controls | |
| Differentiate Without Color Alone | `differentiate-without-color` | Perceive key information via shape or text, not color alone | |
| Sufficient Contrast | `sufficient-contrast` | Read text and iconography meeting WCAG contrast ratios | |
| Reduced Motion | `reduced-motion` | Remove or reduce motion that causes discomfort, following the system setting | |
| Captions | `captions` | Follow video/audio content via complete, time-synchronized captions | |
| Audio Descriptions | `audio-descriptions` | Hear time-synchronized narration of important visual content | |

## Declaring claims to the scanner

Record intended declarations in `.hig-doctor/accessibility-claims.json` at the
project root:

```json
{
  "claims": ["voiceover", "larger-text", "dark-interface"]
}
```

The hig-doctor audit then checks every category (declared or not) and reports a
readiness signal per category:

- `ready-signal` — supporting code evidence, no critical contradictions
- `partial` — supporting evidence alongside contradicting findings
- `at-risk` — critical contradictions, or a declared/stated claim with no
  supporting evidence
- `no-signal` — nothing detected either way (common for Captions in apps
  without media playback)

CI can gate on declared claims with `hig-doctor <dir> --fail-on-claims`.

## What signals do not mean

A `ready-signal` means the codebase contains the APIs and patterns a supporting
implementation would use. It does not mean the experience works. Before
declaring in App Store Connect, complete the manual verification checklist in
[claim-evidence.md](claim-evidence.md).
````

- [ ] **Step 3: Create `skills/hig-accessibility-audit/references/claim-evidence.md`**:

````markdown
# Claim Evidence and Manual Verification

What the hig-doctor scanner counts as evidence per category, what static
analysis cannot see, and how to verify manually before declaring.

The common-tasks bar applies to every category: primary functionality, first
launch, login, purchases, and settings must all work with the feature enabled.

## VoiceOver (`voiceover`)

**Supporting evidence detected:** `accessibilityLabel`, `accessibilityHint`,
`accessibilityValue`, `accessibilityAddTraits`, `accessibilityAction`,
`accessibilityElement` grouping, `UIAccessibility.post` announcements (Swift);
`accessibilityLabel`/`accessibilityRole` (React Native); `Semantics` widgets
and `semanticLabel` (Flutter).

**Contradicting evidence:** tap gestures without traits, system images without
labels, `isAccessibilityElement = false` on interactive elements, nested
touchables.

**Static analysis cannot see:** reading order, label quality ("button1" passes
the scanner), focus management after navigation, custom rotor support.

**Verify manually:** enable VoiceOver; complete every common task without
looking at the screen; check that every interactive element announces a
meaningful label, role, and state; verify focus lands sensibly after screen
transitions and dismissals.

## Voice Control (`voice-control`)

**Evidence:** shares VoiceOver's labeling evidence — Voice Control navigates by
the same accessibility tree.

**Static analysis cannot see:** whether visible labels match spoken names
(users say what they see), grid/number fallback usability.

**Verify manually:** enable Voice Control; complete common tasks with "Tap
<label>" commands; confirm visible text matches accessible names; test dictation
in every text field.

## Larger Text (`larger-text`)

**Supporting evidence:** Dynamic Type text styles, `dynamicTypeSize`,
`@ScaledMetric`, `adjustsFontForContentSizeCategory`,
`UIFont.preferredFont(forTextStyle:)` (Swift); font-scale awareness (React
Native); `textScaler` usage (Flutter).

**Contradicting evidence:** fixed font sizes, `minimumScaleFactor` below 0.5,
`allowFontScaling={false}` (React Native), pinned `textScaleFactor` (Flutter).

**Static analysis cannot see:** truncation, clipping, and layout breakage at
accessibility sizes.

**Verify manually:** set text size to 200%+ (largest accessibility size);
complete common tasks checking for truncated labels, clipped controls,
overlapping layouts; confirm scrollability of grown content.

## Dark Interface (`dark-interface`)

**Supporting evidence:** color scheme detection, semantic/system colors, asset
catalog colors (which can carry dark variants), dark theme definitions.

**Contradicting evidence:** hardcoded color literals in UI code.

**Static analysis cannot see:** whether asset catalog colors actually define
dark variants, contrast quality in dark mode, unstyled screens.

**Verify manually:** switch to dark mode; visit every screen including alerts,
sheets, and settings; check images/illustrations remain legible.

## Differentiate Without Color Alone (`differentiate-without-color`)

**Supporting evidence:** `accessibilityDifferentiateWithoutColor` checks.

**Static analysis cannot see:** whether color is the sole carrier of meaning in
charts, status indicators, or form validation.

**Verify manually:** review every state communicated by color (errors, success,
selection, live status); confirm each also uses a shape, icon, text, or
position; test with grayscale color filters enabled.

## Sufficient Contrast (`sufficient-contrast`)

**Supporting evidence:** increase-contrast checks, semantic system colors
(which adapt to contrast settings).

**Static analysis cannot see:** actual computed contrast ratios.

**Verify manually:** run Accessibility Inspector's color contrast audit
against WCAG ratios (4.5:1 up to 17pt text, 3:1 at 18pt+ or bold); check both
light and dark appearances; test with Increase Contrast enabled.

## Reduced Motion (`reduced-motion`)

**Supporting evidence:** `accessibilityReduceMotion` /
`UIAccessibility.isReduceMotionEnabled` checks (Swift),
`AccessibilityInfo.isReduceMotionEnabled` (React Native), `disableAnimations`
(Flutter).

**Contradicting evidence:** files that animate without ever consulting the
setting.

**Static analysis cannot see:** whether guarded code paths actually remove the
problematic motion (parallax, zoom, spin, bounce).

**Verify manually:** enable Reduce Motion; confirm large-scale motion is
replaced (crossfade instead of zoom/slide), parallax stops, and auto-playing
motion pauses.

## Captions (`captions`)

**Supporting evidence:** `AVMediaCharacteristic.legible` selection,
`textStyleRules` (honoring system caption styling).

**Contradicting evidence:** AVPlayer usage with no caption plumbing.

**Static analysis cannot see:** whether media assets actually contain caption
tracks, caption completeness and synchronization.

**Verify manually:** enable Closed Captions + SDH; play every media surface;
confirm captions exist, are synchronized, cover relevant sounds, and honor the
user's caption style settings.

## Audio Descriptions (`audio-descriptions`)

**Supporting evidence:** `describesVideo` media characteristic selection.

**Static analysis cannot see:** whether described audio tracks exist in the
content library.

**Verify manually:** enable Audio Descriptions; play video content; confirm a
described track is selected automatically and narration covers important visual
information.
````

- [ ] **Step 4: Register the skill**

4a. `VERSIONS.md`: add to the table (after `hig-technologies`):

```markdown
| hig-accessibility-audit | 1.0.0 | 2026-07-11 |
```

and add at the top of "Recent Changes":

```markdown
### 2026-07-11
- **New skill: `hig-accessibility-audit` (1.0.0)** — Accessibility Nutrition Label readiness guidance. Pairs with the audit CLI's new claim scanning (claim-tagged rules, `.hig-doctor/accessibility-claims.json`, readiness scoreboard, `--fail-on-claims`) and the `hig_audit` MCP claims summary.
```

4b. `.claude-plugin/marketplace.json`: append `"./skills/hig-accessibility-audit"` to the `skills` array, and change `"14 skills"` → `"15 skills"` in `metadata.description`, and `"14 Apple HIG skills"` → `"15 Apple HIG skills"` in the plugin `description`.

- [ ] **Step 5: Validate and commit**

```bash
node packages/hig-doctor/src/cli.js . --verbose
```
Expected: validator passes; `hig-accessibility-audit` listed with no errors (required sections present, version matches VERSIONS.md).

```bash
git add skills/hig-accessibility-audit VERSIONS.md .claude-plugin/marketplace.json
git commit -m "feat: add hig-accessibility-audit skill"
```

---

### Task 12: Docs, rule-count propagation, version bumps, full verification

**Files:**
- Modify: `README.md`, `AGENTS.md` (CLAUDE.md is a symlink to it)
- Modify: `packages/hig-doctor/src-termcast/package.json` (+ `CHANGELOG.md` if present)
- Modify: `packages/hig-doctor/src-mcp/package.json`
- Modify: `.claude-plugin/marketplace.json`, `website/components/AuditDemo.tsx`, `demos/remotion-hig-doctor/README.md`, `demos/remotion-hig-doctor/src/data/report-data.json`
- Modify: `packages/hig-doctor/src-termcast/src/patterns.test.ts` (comment only — no code change needed; verify)

**Interfaces:** none — documentation and version metadata only.

- [ ] **Step 1: Propagate the rule count (359 → 380)**

```bash
grep -rn "359" README.md AGENTS.md .claude-plugin/marketplace.json website/components/AuditDemo.tsx demos/remotion-hig-doctor/README.md demos/remotion-hig-doctor/src/data/report-data.json packages/hig-doctor/src-termcast/package.json
```

Replace each rule-count occurrence with `380` (inspect each hit — replace only rule-count usages, e.g. `"totalRules": 359`, "359 HIG patterns", "359 Human Interface Guidelines rules").

- [ ] **Step 2: Update AGENTS.md**

2a. In the Repository Structure block, after the `patterns.ts` line, add:

```
│       │       ├── claims.ts  # Nutrition Label claim evaluation (readiness signals)
```

2b. Change `── skills/                    # Agent Skills (14 skills)` to `(15 skills)`.

2c. In the Skill Categories table, add a row:

```markdown
| Audit | `hig-accessibility-audit` | Accessibility Nutrition Label readiness |
```

2d. In "Build / Lint / Test Commands" under HIG Audit, add:

```markdown
- Gate CI on declared accessibility claims:
  - `cd packages/hig-doctor/src-termcast && bun run audit <directory> --fail-on-claims`
```

- [ ] **Step 3: Update README.md**

Find the audit CLI feature description (search for "fail-on" or the audit section) and add one bullet/paragraph in matching style:

```markdown
- **Accessibility Nutrition Label readiness** — every audit scores all nine App Store accessibility claims (VoiceOver, Voice Control, Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, Audio Descriptions) from claim-tagged rule evidence. Declare intended claims in `.hig-doctor/accessibility-claims.json` and gate CI with `--fail-on-claims`. Signals are heuristics, not certification — verify manually before declaring in App Store Connect.
```

- [ ] **Step 4: Bump versions**

- `packages/hig-doctor/src-termcast/package.json`: `"version": "1.1.0"` → `"1.2.0"`; description's rule count already updated in Step 1.
- `packages/hig-doctor/src-mcp/package.json`: `"version": "0.2.0"` → `"0.3.0"`.
- `.claude-plugin/marketplace.json`: `metadata.version` `"1.2.0"` → `"1.3.0"`.
- If `packages/hig-doctor/src-termcast/CHANGELOG.md` exists, prepend:

```markdown
## 1.2.0 — 2026-07-11

- Accessibility Nutrition Label claim scanning: 21 new claim-tagged rules (RULE_COUNT 359 → 380), readiness scoreboard in terminal/markdown/JSON output, `.hig-doctor/accessibility-claims.json` declarations, stated-claim extraction from README/fastlane metadata, and a `--fail-on-claims` CI gate.
```

- [ ] **Step 5: Full verification**

```bash
cd packages/hig-doctor/src-termcast && bun test && bun run typecheck && cd ../../..
npm test                                            # root guards: workflow security + patterns sync
node packages/hig-doctor/src/cli.js . --verbose     # skill validator, 15 skills pass
grep -rn "359" README.md AGENTS.md .claude-plugin website/components/AuditDemo.tsx demos/remotion-hig-doctor | grep -v node_modules || echo "COUNT CLEAN"
```
Expected: all suites pass; validator clean; final grep prints `COUNT CLEAN` (no stale rule counts).

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md .claude-plugin/marketplace.json website/components/AuditDemo.tsx demos/remotion-hig-doctor/README.md demos/remotion-hig-doctor/src/data/report-data.json packages/hig-doctor/src-termcast/package.json packages/hig-doctor/src-mcp/package.json
git add packages/hig-doctor/src-termcast/CHANGELOG.md 2>/dev/null || true
git commit -m "docs: document accessibility claim scanning; bump versions (rules 359 -> 380)"
```
