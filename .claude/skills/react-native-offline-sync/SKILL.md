---
name: react-native-offline-sync
description: Use for offline-first React Native flows, local operation queues, reconciliation, and conflict resolution.
---

# react-native-offline-sync

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Define which reads are cached and which writes may be queued. Choose stable operation IDs and server idempotency; persist ordered mutations transactionally. Model pending, in-flight, failed, and confirmed states explicitly. Backoff retries, respect connectivity and authentication, and prevent duplicate scans/submissions. Define conflict rules per entity with product requirements rather than silent last-write-wins. Test restart mid-sync, partial server success, duplicate delivery, clock drift, and changing users.
