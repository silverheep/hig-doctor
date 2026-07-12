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

- `ready-signal` — supporting code evidence and no contradicting findings
- `partial` — supporting evidence alongside contradicting findings (none critical)
- `at-risk` — any critical-severity contradiction; contradicting findings with no
  supporting evidence; or a declared/stated claim with no supporting evidence
- `no-signal` — nothing detected either way and the claim is neither declared
  nor stated (common for Captions in apps without media playback)

CI can gate on declared claims with `hig-doctor <dir> --fail-on-claims`.

## What signals do not mean

A `ready-signal` means the codebase contains the APIs and patterns a supporting
implementation would use. It does not mean the experience works. Before
declaring in App Store Connect, complete the manual verification checklist in
[claim-evidence.md](claim-evidence.md).
