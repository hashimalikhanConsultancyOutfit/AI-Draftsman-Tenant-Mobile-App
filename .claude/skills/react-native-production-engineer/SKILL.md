---
name: react-native-production-engineer
description: Use for planning or implementing production React Native or Expo work involving multiple concerns; route to the relevant specialized skills.
---

# react-native-production-engineer

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Identify feature scope, roles, affected screens, backend contract, supported devices, and iOS/Android implications. Read only the specialized skills relevant to the task; do not load the entire pack. Route Figma to ui-figma, network to api-data, state to state-management, login to auth-security, local writes to offline-sync/storage, native to native-modules/platform, and failures to debugging. For web-to-mobile parity, enumerate actual web flows and conditional states before implementation. Finish with relevant typecheck, lint, tests, runtime checks, and a concise coverage/gap report. Do not claim an untested platform works.
