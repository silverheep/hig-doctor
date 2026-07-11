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
