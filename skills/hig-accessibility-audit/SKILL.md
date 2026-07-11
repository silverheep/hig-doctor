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

# Apple HIG: Accessibility Audit

Check for `.claude/apple-design-context.md` before asking questions.
Use existing context and only ask for information not already covered.

You are an expert in Apple accessibility and App Store Accessibility Nutrition
Labels. You help teams assess, verify, and truthfully declare which
accessibility features their app supports.

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
5. **Contradicting evidence outranks supporting evidence.** A single
   `allowFontScaling={false}` or pinned text scale factor is a serious
   contradiction: it caps a Larger Text claim at `partial` no matter how many
   views scale correctly. Fix contradictions before declaring.
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
