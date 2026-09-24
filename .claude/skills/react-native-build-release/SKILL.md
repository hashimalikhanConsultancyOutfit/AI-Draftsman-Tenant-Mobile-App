---
name: react-native-build-release
description: Use for Expo EAS or native build configuration, signing, environment variants, OTA updates, and release artifacts.
---

# react-native-build-release

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect Expo/bare setup and existing profiles. Separate development, preview and production identifiers, endpoints, entitlements and secrets. Check native dependency/config changes require a fresh binary, and OTA compatibility/runtime version. Keep signing credentials out of repository and logs. Build the requested platform/profile, install artifact, run smoke flow and record build/version identifiers.
