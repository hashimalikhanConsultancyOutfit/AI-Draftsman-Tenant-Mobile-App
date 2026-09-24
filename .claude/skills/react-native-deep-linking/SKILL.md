---
name: react-native-deep-linking
description: Use for app links, universal links, custom schemes, invitations, and OAuth callback routes.
---

# react-native-deep-linking

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect route patterns and domain association configuration. Parse and validate untrusted URLs, map to typed destinations, and avoid credentials in URLs. Queue links until auth/navigation bootstrap; enforce permission for protected content. Test installed/not installed, warm/cold start, login redirect, malformed links, and both platforms.
