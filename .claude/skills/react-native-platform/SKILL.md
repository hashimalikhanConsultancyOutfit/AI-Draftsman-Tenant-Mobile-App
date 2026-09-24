---
name: react-native-platform
description: Use for iOS/Android-specific React Native behavior, lifecycle, native configuration, or platform differences.
---

# react-native-platform

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect Podfile, Gradle, app config, target SDK and deployment target. Keep platform branches narrow and typed. Account for back gesture/button, keyboard, safe areas, status bar, process recreation, background restrictions and file URI differences. Check simulator/emulator limits versus physical devices. Verify changes on relevant iOS/Android build and runtime.
