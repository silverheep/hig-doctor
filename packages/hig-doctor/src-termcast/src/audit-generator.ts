// audit-generator.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ScanResult } from "./scanner";
import type { CategorySummary } from "./categorizer";
import { CLAIMS_DISCLAIMER, CLAIMS_CONFIG_RELPATH, type ClaimsEvaluation } from "./claims";

function formatDate(): string {
  return new Date().toISOString().split("T")[0];
}

function langForFile(file: string): string {
  if (file.endsWith(".swift")) return "swift";
  if (file.endsWith(".tsx") || file.endsWith(".jsx")) return "tsx";
  if (file.endsWith(".ts") || file.endsWith(".js")) return "typescript";
  if (file.endsWith(".css") || file.endsWith(".scss")) return "css";
  if (file.endsWith(".html") || file.endsWith(".htm")) return "html";
  if (file.endsWith(".dart")) return "dart";
  if (file.endsWith(".kt")) return "kotlin";
  return "";
}

function commentPrefix(file: string): string {
  if (file.endsWith(".css") || file.endsWith(".scss")) return "/* ";
  return "// ";
}

function commentSuffix(file: string): string {
  if (file.endsWith(".css") || file.endsWith(".scss")) return " */";
  return "";
}

function escapeMarkdownText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+.!|-])/g, "\\$1");
}

function longestRun(value: string, char: string): number {
  let longest = 0;
  let current = 0;
  for (const c of value) {
    if (c === char) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function fenceFor(matches: CategorySummary["matches"]): string {
  const longestTildeRun = matches.reduce(
    (max, match) => Math.max(max, longestRun(match.lineContent, "~")),
    0,
  );
  return "~".repeat(Math.max(3, longestTildeRun + 1));
}

function sanitizeExcerptLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ");
}

function renderExcerpts(category: CategorySummary): string {
  const lines: string[] = [];
  const byFile = new Map<string, typeof category.matches>();
  for (const m of category.matches) {
    if (!byFile.has(m.file)) byFile.set(m.file, []);
    byFile.get(m.file)!.push(m);
  }

  for (const [file, matches] of byFile) {
    const lang = langForFile(file);
    const cp = commentPrefix(file);
    const cs = commentSuffix(file);
    const fence = fenceFor(matches);
    lines.push(`**${escapeMarkdownText(file)}**`);
    lines.push(`${fence}${lang}`);
    for (const m of matches.slice(0, 15)) {
      const tag = m.type === "concern" ? ` ${cp}⚠ concern${cs}` : m.type === "positive" ? ` ${cp}✓ good${cs}` : "";
      lines.push(`L${m.line}: ${sanitizeExcerptLine(m.lineContent)}${tag}`);
    }
    if (matches.length > 15) {
      lines.push(`${cp}... and ${matches.length - 15} more matches${cs}`);
    }
    lines.push(fence);
    lines.push("");
  }

  return lines.join("\n");
}

export async function loadSkillContent(skillsDir: string, skillName: string): Promise<string | null> {
  try {
    const skillPath = join(skillsDir, skillName, "SKILL.md");
    const content = await readFile(skillPath, "utf-8");
    const stripped = content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
    const principlesMatch = stripped.match(/## Key Principles\n([\s\S]*?)(?=\n## |$)/);
    return principlesMatch ? principlesMatch[1].trim() : stripped.slice(0, 2000);
  } catch {
    return null;
  }
}

export function generateAuditMarkdown(
  scanResult: ScanResult,
  categories: CategorySummary[],
  skillsDir: string | null,
  skillContents?: Map<string, string>,
  claims?: ClaimsEvaluation,
): string {
  const lines: string[] = [];
  const appName = scanResult.directory.split("/").pop() || "App";

  // Header
  lines.push(`# HIG Audit: ${appName}`);
  lines.push("");
  lines.push(`**Generated**: ${formatDate()}`);
  lines.push(`**Project**: ${scanResult.directory}`);
  lines.push(`**Frameworks detected**: ${scanResult.frameworks.join(", ")}`);
  const fileCounts = [
    `${scanResult.codeFiles.length} code`,
    `${scanResult.styleFiles.length} style`,
    `${scanResult.configFiles.length} config`,
  ].join(", ");
  lines.push(`**Files scanned**: ${fileCounts}`);
  lines.push("");

  // Summary stats
  const totalConcerns = categories.reduce((s, c) => s + c.concerns, 0);
  const totalPositives = categories.reduce((s, c) => s + c.positives, 0);
  const totalPatterns = categories.reduce((s, c) => s + c.patterns, 0);
  lines.push(`**Quick stats**: ${totalConcerns} potential concerns, ${totalPositives} positive patterns, ${totalPatterns} component usages detected across ${categories.length} HIG categories`);
  lines.push("");

  if (claims) {
    lines.push(renderClaimsSection(claims));
    lines.push("");
  }

  // Instructions
  lines.push("## Instructions for AI Evaluator");
  lines.push("");
  lines.push("You are reviewing a project for Apple Human Interface Guidelines compliance.");
  lines.push("The HIG principles (accessibility, color systems, typography, responsive layout, motion) apply to all surfaces — native, web, and cross-platform.");
  lines.push("For each category below, evaluate the code excerpts against the HIG reference material.");
  lines.push("");
  lines.push("**Scoring**: Rate each category 1-10:");
  lines.push("- **9-10**: Excellent HIG compliance, follows best practices");
  lines.push("- **7-8**: Good compliance with minor improvements possible");
  lines.push("- **5-6**: Partial compliance, several areas need attention");
  lines.push("- **3-4**: Significant HIG violations");
  lines.push("- **1-2**: Major violations or missing fundamental practices");
  lines.push("");
  lines.push("**Output**: For each category, provide:");
  lines.push("1. Score (1-10)");
  lines.push("2. What's done well (cite specific code)");
  lines.push("3. What needs improvement (cite specific file:line)");
  lines.push("4. Specific fix recommendations");
  lines.push("");

  // Categories
  for (const category of categories) {
    lines.push(`## Category: ${category.label}`);
    lines.push("");
    lines.push(`*${category.matches.length} detections across ${category.fileCount} file(s) — ${category.concerns} concern(s), ${category.positives} positive(s)*`);
    lines.push("");

    lines.push("### Code Excerpts");
    lines.push("");
    if (category.matches.length > 0) {
      lines.push(renderExcerpts(category));
    } else {
      lines.push("*No patterns detected for this category.*");
      lines.push("");
    }

    lines.push("### HIG Reference");
    lines.push("");
    const content = skillContents?.get(category.skillName);
    if (content) {
      lines.push(content);
    } else {
      lines.push(`*Load reference from skill: ${category.skillName}*`);
    }
    lines.push("");

    lines.push("### Evaluate");
    lines.push("");
    const checks = getEvaluationChecklist(category.skillName);
    for (const check of checks) {
      lines.push(`- ${check}`);
    }
    lines.push("");
  }

  // Scoring table
  lines.push("## Scoring Summary");
  lines.push("");
  lines.push("| Category | Score (1-10) | Key Findings |");
  lines.push("|----------|-------------|-------------|");
  for (const category of categories) {
    lines.push(`| ${category.label} | | |`);
  }
  lines.push("| **Overall** | **/10** | |");
  lines.push("");

  return lines.join("\n");
}

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

function getEvaluationChecklist(skillName: string): string[] {
  const checklists: Record<string, string[]> = {
    "hig-foundations": [
      "Color usage: system semantic colors vs hardcoded values",
      "Typography: Dynamic Type text styles vs fixed font sizes",
      "Accessibility: labels, hints, traits on interactive elements",
      "Dark mode: proper color adaptation, no hardcoded light/dark values",
      "Motion: Reduce Motion support for animations",
    ],
    "hig-components-layout": [
      "Navigation pattern matches app structure (prefer tab bar; sidebar-adaptable tab bar or NavigationSplitView for complex hierarchies)",
      "Adaptive layout: responds to size classes, multitasking",
      "Standard navigation components (NavigationSplitView, not deprecated NavigationView)",
      "Consistent back navigation and spatial hierarchy",
    ],
    "hig-components-controls": [
      "Standard control usage (Button, Toggle, Picker, etc.)",
      "Proper button styles and roles",
      "Clear action labels and consistent interaction patterns",
    ],
    "hig-components-menus": [
      "Context menus provide relevant actions",
      "Menu organization follows HIG grouping conventions",
    ],
    "hig-components-dialogs": [
      "Alerts used sparingly for important decisions",
      "Sheets for focused tasks, popovers for contextual info",
      "Confirmation dialogs for destructive actions",
    ],
    "hig-components-search": [
      "Searchable modifier used for filterable content",
      "Search suggestions and scopes where appropriate",
    ],
    "hig-components-status": [
      "Progress indicators for long operations",
      "Appropriate use of determinate vs indeterminate progress",
    ],
    "hig-components-content": [
      "Content display uses appropriate containers",
      "Image handling with proper async loading",
    ],
    "hig-components-system": [
      "System integration uses standard APIs (ShareLink, PhotosPicker)",
      "Deep link handling, widget support where relevant",
    ],
    "hig-patterns": [
      "Drag and drop support where appropriate",
      "Pull-to-refresh for refreshable content",
      "Swipe actions follow HIG conventions",
      "Undo support for destructive actions",
    ],
    "hig-inputs": [
      "Text input uses appropriate field types",
      "Keyboard shortcuts for power users (macOS/iPad)",
      "Gesture usage follows platform conventions",
    ],
    "hig-technologies": [
      "Apple framework integration follows HIG for that technology",
      "Proper permission handling and progressive disclosure",
    ],
    "hig-platforms": [
      "UI adapts appropriately across target platforms",
      "Platform idioms respected (iPhone vs iPad vs Mac)",
    ],
  };
  return checklists[skillName] ?? ["Evaluate against Apple HIG best practices for this category"];
}
