---
name: react-native-notifications
description: Use for push notifications, FCM/APNs/OneSignal, foreground handling, and notification navigation.
---

# react-native-notifications

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Check SDK integration and credentials by environment. Register token after consent, associate with active account, update on rotation, and remove association on logout. Handle foreground, background and terminated entry paths with deduplication and typed payload validation. Route only after navigation/auth bootstrap and authorization checks. Verify Android channels and iOS capabilities on physical devices.
