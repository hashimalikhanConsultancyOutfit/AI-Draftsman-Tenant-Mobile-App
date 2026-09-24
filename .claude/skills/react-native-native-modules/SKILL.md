---
name: react-native-native-modules
description: Use when adding or debugging Swift/Kotlin native modules, Fabric, TurboModules, JSI, or native SDK integrations.
---

# react-native-native-modules

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect RN/Expo versions, New Architecture configuration and library compatibility. Prefer a maintained compatible package; for Expo managed apps decide whether a config plugin and development build are required. Define the JS/TS contract, native lifecycle, error mapping, threading and event cleanup. Apply platform manifest/Info.plist permissions and minimum OS rules. Build and exercise on both affected platforms; document platform-specific behavior.
