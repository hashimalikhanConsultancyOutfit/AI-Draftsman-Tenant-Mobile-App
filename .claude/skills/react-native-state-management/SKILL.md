---
name: react-native-state-management
description: Use for Redux Toolkit, Zustand, Context, selectors, persistence, or client/server state boundaries in React Native.
---

# react-native-state-management

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Identify which data is server owned, transient UI, persisted preferences, and sensitive credentials. Follow existing store. Keep server cache in existing query layer when available; avoid duplicate Redux copies. Use selectors with stable derived values, clear ownership for updates, and persistence migrations when schema changes. Never persist secrets in unencrypted general storage. Confirm hydration and logout cleanup.
