---
name: react-native-store-release
description: Use for preparing or submitting React Native apps to Google Play or App Store, tracks, metadata, and phased rollout.
---

# react-native-store-release

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Check package/bundle IDs, version codes/build numbers, signing, privacy disclosures, permission declarations, screenshots, content rating and account requirements against current store guidance. Validate real-device release build and critical flows. Select intended track/audience and release notes; monitor crash-free sessions after rollout. Confirm before any irreversible publication if authorization is not already given.
