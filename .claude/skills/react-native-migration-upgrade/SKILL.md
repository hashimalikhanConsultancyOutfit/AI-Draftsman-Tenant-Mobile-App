---
name: react-native-migration-upgrade
description: Use for upgrading React Native, Expo SDK, dependencies, or New Architecture compatibility.
---

# react-native-migration-upgrade

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Record current and target versions and package manager. Read the matching official upgrade guide and dependency compatibility; plan incrementally. For Expo, align supported package versions with the target SDK. Review native changes, patches, plugins, pods, Gradle and app config. Build both platforms and test core flows; keep rollback path and report known incompatible libraries.
