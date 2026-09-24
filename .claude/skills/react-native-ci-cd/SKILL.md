---
name: react-native-ci-cd
description: Use to implement or maintain React Native CI, EAS, Fastlane, and automated build/test pipelines.
---

# react-native-ci-cd

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect current CI and package manager lockfile. Cache only safe dependencies, pin toolchain appropriately, separate typecheck/lint/tests from device builds, and gate releases on relevant checks. Inject credentials with secret manager; restrict release permissions. Archive logs/artifacts without secrets. Test the workflow on a branch and verify failure handling and artifact naming.
