---
name: react-native-animations
description: Use for React Native gestures, transitions, Reanimated animations, and interaction motion.
---

# react-native-animations

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Match behavior and duration to product design; favor UI-thread driven motion for interaction-sensitive work. Avoid animating layout-heavy trees where transform/opacity suffices. Support reduced-motion preferences and cancellation on unmount/navigation. Test slow devices, gesture conflicts and interrupt/restart behavior.
