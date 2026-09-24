---
name: react-native-forms-validation
description: Use for React Native forms, React Hook Form/Formik, Yup/Zod, conditional fields, and submission UX.
---

# react-native-forms-validation

## Working rules
1. Inspect the repository, package versions, app configuration, and relevant existing feature before choosing a pattern. Respect Expo managed/prebuild versus bare React Native and the current architecture.
2. Reuse project components, services, naming, error handling, and conventions. Preserve business behavior and avoid unrelated rewrites or dependencies.
3. State assumptions only when information is unavailable; check types, API contracts, and platform behavior instead of guessing.
4. Make the smallest complete change. Verify the affected workflow with targeted checks available in this repository; report what ran and what remains unverified.

## Task-specific workflow
Reuse existing form stack. Derive validation from API constraints; make conditional requirements depend on current values and reset stale hidden fields if appropriate. Handle keyboard avoidance, focus order, accessible error text, server errors, duplicate submits, loading and disabled state. Test valid/invalid cases, edit mode, network failure and unsaved changes.
