---
name: react-native-performance
description: Use for slow React Native screens, large lists, startup, images, animations, memory, and profiling.
---

# react-native-performance

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Measure in production/release mode and reproduce on target device before optimization. Profile JS/UI frame drops, rerenders, list virtualization, image decoding, selectors, network waterfalls, startup and memory. Change one likely bottleneck at a time; avoid blanket memoization. For lists, verify stable keys, item sizing if known, pagination, and offscreen rendering. Re-measure and report baseline versus result.
