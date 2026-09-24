---
name: react-native-testing
description: Use when adding or selecting meaningful tests for React Native business logic, screens, and critical user flows.
---

# react-native-testing

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Choose fast unit tests for pure logic, component/integration tests for UI state and mutations, and E2E for critical auth/payment/role flows. Test observed behavior and failure paths instead of implementation details. Mock system boundaries, not the logic under test. Keep tests deterministic across timers, network and navigation. Run focused tests and distinguish unrun E2E from passing tests.
