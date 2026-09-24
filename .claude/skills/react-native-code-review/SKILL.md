---
name: react-native-code-review
description: Use to review React Native changes for bugs, regressions, security, performance, and platform risks.
---

# react-native-code-review

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect diff and surrounding behavior, contracts and tests. Report actionable findings ordered by severity with exact file/line, failure scenario, impact and fix. Check stale closures, races, effect cleanup, permission edges, auth leaks, navigation, accessibility and iOS/Android parity. Distinguish confirmed issues from hypotheses and list testing gaps. Avoid broad rewrites and style-only noise.
