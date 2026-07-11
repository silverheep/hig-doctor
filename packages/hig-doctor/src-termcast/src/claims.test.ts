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
  extractStatedClaims,
  evaluateClaims,
  type ClaimsEvaluation,
} from "./claims";
import type { PatternMatch } from "./patterns";

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
