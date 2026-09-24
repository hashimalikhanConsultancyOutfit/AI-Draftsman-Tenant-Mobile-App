---
name: react-native-storage
description: Use for AsyncStorage, MMKV, SQLite, secure storage, persistence migrations, and cache retention.
---

# react-native-storage

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Choose storage by sensitivity, query size, durability and Expo/native support. Isolate storage behind a typed interface, version schema and migrate transactionally with rollback strategy. Keep tokens in protected platform storage. Bound cached data and cleanup on logout/account switch. Test reinstall vs upgrade, corruption, full disk, schema migration and concurrent writes.
