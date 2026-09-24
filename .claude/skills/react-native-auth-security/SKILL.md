---
name: react-native-auth-security
description: Use for mobile authentication, OAuth, tokens, biometric access, sessions, and app security reviews.
---

# react-native-auth-security

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect existing identity provider and threat-sensitive data. Use platform protected storage for tokens; keep private server secrets on server. For OAuth use system browser and PKCE where supported; verify redirect URI and state. Handle refresh concurrency, rotation, expiration, logout revocation, account switching, and device clock issues. Remove tokens from logs/analytics and sanitize deep links. Test cold start, offline startup, expiry, and logout.
