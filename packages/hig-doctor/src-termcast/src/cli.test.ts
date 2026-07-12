// cli.test.ts — End-to-end CLI behavior: exit codes for --fail-on-claims and
// the --json claims shape. Runs the CLI as a real subprocess (via Bun.spawnSync)
// against fixture projects built in temp dirs, so it exercises the actual
// argv-parsing / exit-code wiring in cli.ts, not just the library functions
// covered by claims.test.ts and audit.test.ts.
import { describe, test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// This file lives in <src-termcast>/src/, so the package root is one level up.
const PKG_DIR = join(import.meta.dir, "..");
const SPAWN_TIMEOUT_MS = 15_000;

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "hig-cli-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

interface CliRun {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(fixtureDir: string, args: string[] = []): CliRun {
  const proc = Bun.spawnSync({
    cmd: ["bun", "src/cli.ts", fixtureDir, ...args],
    cwd: PKG_DIR,
    stdout: "pipe",
    stderr: "pipe",
    timeout: SPAWN_TIMEOUT_MS,
  });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

async function writeDeclaredClaims(dir: string, claims: string[]): Promise<void> {
  await mkdir(join(dir, ".hig-doctor"), { recursive: true });
  await writeFile(
    join(dir, ".hig-doctor", "accessibility-claims.json"),
    JSON.stringify({ claims }),
  );
}

// Applicable (SwiftUI) fixture with one piece of accessibility evidence:
// `.accessibilityLabel(` supports voiceover + voice-control, and nothing else.
// So "captions" (declared in most fixtures below) has zero supporting evidence
// and scans at-risk, while "voiceover" is clean.
const APP_SWIFT = `import SwiftUI

struct ContentView: View {
  var body: some View {
    Text("Hi").accessibilityLabel("x")
  }
}
`;

describe("cli --fail-on-claims", () => {
  test("declared claim at-risk + --fail-on-claims exits 1", async () => {
    await withTempDir(async dir => {
      await writeDeclaredClaims(dir, ["captions"]);
      await writeFile(join(dir, "App.swift"), APP_SWIFT);
      const { exitCode } = runCli(dir, ["--fail-on-claims"]);
      expect(exitCode).toBe(1);
    });
  }, SPAWN_TIMEOUT_MS);

  test("same fixture without --fail-on-claims exits 0", async () => {
    await withTempDir(async dir => {
      await writeDeclaredClaims(dir, ["captions"]);
      await writeFile(join(dir, "App.swift"), APP_SWIFT);
      const { exitCode } = runCli(dir, []);
      expect(exitCode).toBe(0);
    });
  }, SPAWN_TIMEOUT_MS);

  test("declared claim clean + --fail-on-claims exits 0", async () => {
    await withTempDir(async dir => {
      await writeDeclaredClaims(dir, ["voiceover"]);
      await writeFile(join(dir, "App.swift"), APP_SWIFT);
      const { exitCode } = runCli(dir, ["--fail-on-claims"]);
      expect(exitCode).toBe(0);
    });
  }, SPAWN_TIMEOUT_MS);

  test("not applicable (no App Store framework) + --fail-on-claims exits 0", async () => {
    await withTempDir(async dir => {
      await writeDeclaredClaims(dir, ["captions"]);
      await writeFile(join(dir, "index.js"), `console.log("hi");\n`);
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "x", dependencies: { express: "^4.0.0" } }),
      );
      const { exitCode } = runCli(dir, ["--fail-on-claims"]);
      expect(exitCode).toBe(0);
    });
  }, SPAWN_TIMEOUT_MS);
});

describe("cli --json claims shape", () => {
  test("emits schemaVersion 1 and nine well-formed claim assessments", async () => {
    await withTempDir(async dir => {
      await writeDeclaredClaims(dir, ["voiceover"]);
      await writeFile(join(dir, "App.swift"), APP_SWIFT);
      const { exitCode, stdout } = runCli(dir, ["--json"]);
      expect(exitCode).toBe(0);

      const parsed = JSON.parse(stdout);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.claims.applicable).toBe(true);
      expect(parsed.claims.assessments.length).toBe(9);
      expect(parsed.failOnClaims).toBe(false);
      expect(parsed.claimsGateTripped).toBe(false);

      for (const a of parsed.claims.assessments) {
        expect(typeof a.id).toBe("string");
        expect(typeof a.label).toBe("string");
        expect(typeof a.signal).toBe("string");
        expect(typeof a.declared).toBe("boolean");
        expect(typeof a.supporting).toBe("number");
        expect(typeof a.contradicting).toBe("number");
        expect(Array.isArray(a.examples.supporting)).toBe(true);
        expect(a.examples.supporting.length).toBeLessThanOrEqual(5);
        expect(Array.isArray(a.notes)).toBe(true);
      }

      const voiceover = parsed.claims.assessments.find((a: { id: string }) => a.id === "voiceover");
      expect(voiceover.declared).toBe(true);
    });
  }, SPAWN_TIMEOUT_MS);
});

describe("cli malformed accessibility-claims.json", () => {
  test("exits 2 and stderr names the config file", async () => {
    await withTempDir(async dir => {
      await mkdir(join(dir, ".hig-doctor"), { recursive: true });
      await writeFile(join(dir, ".hig-doctor", "accessibility-claims.json"), "{not json");
      await writeFile(join(dir, "App.swift"), APP_SWIFT);
      const { exitCode, stderr } = runCli(dir, []);
      expect(exitCode).toBe(2);
      expect(stderr).toContain("accessibility-claims.json");
    });
  }, SPAWN_TIMEOUT_MS);
});
