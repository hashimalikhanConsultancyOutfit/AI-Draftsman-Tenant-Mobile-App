---
name: react-native-navigation
description: Use for React Navigation or Expo Router flows, stacks, tabs, drawers, route params, auth/role routing, and back behavior.
---

# react-native-navigation

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect installed router, existing route definitions, linking, and roles. Define typed route parameters and unique destinations. Gate protected routes from authoritative auth state; handle bootstrap/loading and expired sessions. Test cold start, deep link, nested back, modal dismissal, logout, role changes, and restored navigation state. Keep access checks in server logic as well as UI where applicable.
