---
title: "Dock menus | Apple Developer Documentation"
source: https://developer.apple.com/design/human-interface-guidelines/dock-menus
---

<!-- hig-doctor:attribution -->
> **Source**: Apple Inc. Canonical content at https://developer.apple.com/design/human-interface-guidelines/dock-menus.
> This file reproduces that content for AI agent reference, snapshot 2026-06-11.
> Apple HIG text is © Apple Inc.; imagery is omitted. This repository provides organization and cross-referencing for AI agent consumption only.

# Dock menus

The system-provided Dock menu items can vary depending on whether the app is open. For example, the Dock menu for Safari includes menu items for actions like viewing a current window or creating a new window.

> **Note:** Although iOS and iPadOS don’t support a Dock menu, people can reveal a similar menu of system-provided and custom items — called Home Screen quick actions — when they long press an app icon on the Home Screen or in the Dock. For guidance, see [Home Screen quick actions](https://developer.apple.com/design/human-interface-guidelines/home-screen-quick-actions).

## Best practices

As with all menus, you need to label Dock menu items succinctly and organize them logically. For guidance, see [Menus](https://developer.apple.com/design/human-interface-guidelines/menus).

**Make custom Dock menu items available in other places, too.** Not everyone uses a Dock menu, so it’s important to offer the same commands elsewhere, like in your menu bar menus or within your interface.

**Prefer high-value custom items for your Dock menu.** For example, a Dock menu can list all currently or recently open windows, making it a convenient way to jump to the window people want. Also consider listing a few of the actions that are most likely to be useful when your app isn’t frontmost or when there are no open windows. For example, Mail includes items for getting new mail and composing a new message in addition to listing all open windows.

## Platform considerations

*Not supported in iOS, iPadOS, tvOS, visionOS, or watchOS.*

## Resources

#### Related

[Menus](https://developer.apple.com/design/human-interface-guidelines/menus)

[Home Screen quick actions](https://developer.apple.com/design/human-interface-guidelines/home-screen-quick-actions)

#### Developer documentation

[applicationDockMenu(_:)](https://developer.apple.com/documentation/AppKit/NSApplicationDelegate/applicationDockMenu(_:)) — AppKit

---

<!-- hig-doctor:canonical-footer -->
For the complete guidance, including worked examples and illustrations, see the canonical page: https://developer.apple.com/design/human-interface-guidelines/dock-menus
