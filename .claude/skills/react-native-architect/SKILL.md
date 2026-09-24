---
name: react-native-architect
description: Use when creating or restructuring React Native features, modules, boundaries, or project architecture.
---

# react-native-architect

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Map existing feature structure and dependency direction. Keep screens focused on composition, feature logic in feature hooks/services, shared primitives in shared locations, and server contracts behind data access. Prefer feature boundaries for growing apps, but do not force a template over established architecture. Define navigation, error, loading, authorization, and empty states per feature. Avoid circular imports and premature abstractions. Verify imports and representative feature flows.
