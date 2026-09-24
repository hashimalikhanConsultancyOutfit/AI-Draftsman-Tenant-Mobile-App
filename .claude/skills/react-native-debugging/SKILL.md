---
name: react-native-debugging
description: Use to diagnose Metro, Expo, Hermes, Gradle, CocoaPods, Xcode, signing, runtime, or network failures.
---

# react-native-debugging

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Capture command, environment, version and first meaningful error. Classify environment, native build, JS bundle, runtime or backend. Trace from the first root cause, inspect the minimal relevant config, reproduce, then change one cause. Avoid cache deletion or dependency upgrades without evidence. Rerun the failing command and report result; distinguish simulator/device and debug/release.
