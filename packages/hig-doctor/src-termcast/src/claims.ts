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
