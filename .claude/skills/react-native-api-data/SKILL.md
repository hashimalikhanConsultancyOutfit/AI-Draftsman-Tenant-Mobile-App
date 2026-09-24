---
name: react-native-api-data
description: Use for REST/GraphQL integration, query caching, pagination, mutations, retries, and API typing in React Native.
---

# react-native-api-data

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Read endpoint contract, auth conventions, existing HTTP client and query library. Separate network client, endpoint service, typed model conversion, and screen hook where project conventions support it. Handle loading, empty, error, cancellation/stale responses, pagination cursor correctness, and unauthorized refresh behavior. Retry only safe operations unless idempotency is guaranteed; avoid duplicate mutations. Verify request and response with real contract or fixtures and check offline transitions.
