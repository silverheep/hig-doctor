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

**Verify manually:** run Accessibility Inspector's color contrast audit using Apple's guidance
values (4.5:1 for text up to 17pt, 3:1 for 18pt+ or bold text; WCAG 1.4.3
itself sets 3:1 only for 18pt+ regular or 14pt+ bold); check both
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
