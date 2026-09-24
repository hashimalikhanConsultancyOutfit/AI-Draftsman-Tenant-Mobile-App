---
name: react-native-permissions
description: Use for camera, Bluetooth, location, media, notification, microphone, or other mobile permission flows.
---

# react-native-permissions

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Enumerate each permission by platform and OS version; inspect existing manifest, plist and Expo config plugin setup. Request just before feature use with clear rationale. Handle granted, denied, limited, blocked, and settings-return states; provide graceful fallback. Avoid repeated prompts and excess permissions. Test clean install, denial, revocation and upgrade.
