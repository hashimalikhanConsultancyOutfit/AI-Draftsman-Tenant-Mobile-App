---
name: react-native-realtime
description: Use for Socket.IO/WebSockets, chat, presence, subscriptions, and live data updates.
---

# react-native-realtime

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Define connection owner and auth handoff. Subscribe once per lifecycle, unregister exactly on cleanup, reconnect with backoff and resubscribe after session change. Make events idempotent, ordered by server sequence or timestamp if supported, and reconcile with fetched state. Handle offline gaps, app foreground/background, duplicate delivery, and account switch. Test multi-device updates.
