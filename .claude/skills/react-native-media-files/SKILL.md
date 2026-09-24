---
name: react-native-media-files
description: Use for camera/gallery, file picking, image processing, document uploads and downloads in React Native.
---

# react-native-media-files

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Inspect current picker and file abstractions. Handle permission states, content:// versus file://, MIME/type/size limits, cancellation, progress, retry and cleanup of temporary files. Stream or chunk large files where supported; avoid base64 for large assets. Name downloads safely and use platform share/open APIs. Test background interruption, duplicate upload, and low storage.
