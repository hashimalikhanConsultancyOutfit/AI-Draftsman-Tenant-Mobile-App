---
name: react-native-ui-figma
description: Use when implementing React Native or Expo screens/components from Figma, including responsive layouts and design parity.
---

# react-native-ui-figma

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect the exact node, child layers, variants, assets, interaction states, typography, spacing, colors, and component constraints. Compare with existing tokens and components; reuse them when equivalent. Capture all sections and states before coding; identify mobile/tablet frames where supplied. Implement with flex layouts, safe areas, keyboard handling, scrolling and content expansion. Avoid arbitrary device-width formulas and fixed heights for dynamic text. Check small and large phones, font scaling, dark mode if supported, and both platforms. Compare rendered output with the Figma source; list any inaccessible values or deliberate differences.
