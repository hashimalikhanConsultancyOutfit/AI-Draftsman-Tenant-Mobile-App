---
name: react-native-accessibility
description: Use when building or reviewing React Native accessibility, screen readers, font scaling, focus, and contrast.
---

# react-native-accessibility

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Check semantics, descriptive labels, roles, state announcements, focus order, touch targets, dynamic type and sufficient contrast. Avoid duplicate announcements for grouped UI and avoid color-only meaning. Test VoiceOver and TalkBack on important flows, text enlargement, keyboard where applicable, and modal focus restoration.
