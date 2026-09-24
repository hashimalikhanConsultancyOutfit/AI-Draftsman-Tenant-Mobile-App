---
name: react-native-device-integrations
description: Use for barcode, RFID, NFC, Bluetooth scanners, printer SDKs, and specialized handheld hardware.
---

# react-native-device-integrations

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Identify hardware model, transport and scan delivery mode (keyboard wedge, intent, SDK or native callback). Treat scan payload as untrusted and normalize only per backend contract. Deduplicate repeated reads without losing legitimate scans; manage focus and background lifecycle. Handle disconnect, permission, battery, retry and offline queue. Test real hardware, manual fallback, barcode/RFID equivalent flows and Android/iOS support.
