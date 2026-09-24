---
name: react-native-design-system
description: Use for maintaining shared React Native tokens, typography, icons, themes, and reusable UI primitives.
---

# react-native-design-system

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect existing tokens and Figma component variants. Define semantic colors, scalable type, spacing and component APIs without forcing one-off screens into shared primitives. Include loading, disabled, error, pressed and accessibility states; account for dark mode if supported. Update representative usages and check regression on small screens and font scaling.
