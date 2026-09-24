---
name: react-native-analytics-monitoring
description: Use for analytics events, crash reporting, performance monitoring, and privacy-safe diagnostic logs.
---

# react-native-analytics-monitoring

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect existing provider and consent policy. Define consistent event names/properties with no secrets or personal data unless expressly required and allowed. Tie errors to actionable context, release/environment, and stable anonymous correlation. De-duplicate events, handle offline batching, and respect logout/account changes. Verify event delivery and crash symbols/source maps for the release pipeline.
