---
name: react-native-error-handling
description: Use for user-visible errors, retries, error boundaries, and recoverable failures across React Native features.
---

# react-native-error-handling

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Classify validation, network, auth, permission and unexpected failures. Map API errors centrally to clear messages and actionable retry where safe. Show loading/empty/error distinctly; retain user input on recoverable failures. Send diagnostic context without secrets and avoid duplicate toasts. Test repeated failure, recovery and offline transitions.
