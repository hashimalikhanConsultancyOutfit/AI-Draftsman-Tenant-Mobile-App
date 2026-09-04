# Analytics module — spec

## Scope

Where consumption went over a 7/30/90-day window. Mobile's equivalent of
web's `MySettings` dialog's `analytics` tab (`AnalyticsPanel`). A Settings
sub-screen (`SettingsStack`'s `Analytics` route), replacing the
pre-existing placeholder.

Backed by `GET /auth/my-settings/analytics`, the same b2b-billing service
(`insights.service.ts`) that answers Usage and credits, but a different
read — a usage REPORT (totals, breakdowns, durations) rather than a
wallet. Confirmed against the real controller/service code directly, not
just Swagger doc-comments (both agreed — no drift found), 2026-09-04.

## Correction applied during the build

The placeholder this replaces gated the **whole screen** on
`usage.view`. That was wrong: web's `MySettings.data.ts` lists `analytics`
in the same ungated "account" nav group as `usage-credits`, and there's
no permission guard on the route server-side either. The real screen is
reachable by anyone; only the money/usage figures inside are gated via
`usePermission(USAGE_PERMISSIONS.VIEW)` — exactly the pattern
`UsageCreditsScreen` already established (an em-dash + "Needs the 'View
usage' permission" caption in place of a hidden row). The home list's
sublabel was also corrected to web's actual copy ("Where consumption went
over the last 7, 30 or 90 days").

## Data layer

- `analytics.types.ts` — `UsageAnalytics`, `DailyUsagePoint`,
  `UsageBreakdownSlice`, `DurationBucket`, confirmed field-for-field
  against `insights.service.ts::getUsageAnalytics` (the controller's own
  local `AnalyticsFromLedger` type is a minimal relabel-step typing, not
  the full contract — `insights.entity.ts` is authoritative). Documents
  three real characteristics: three usage meters are unioned server-side
  and `byAgent` can legitimately sum to less than the total (a computer
  session has no agent); `byAgent`/`byCustomer`'s `key` is a name when
  server-side resolution succeeds and a raw id when it silently doesn't
  (no field anywhere distinguishes the two — confirmed by reading the
  gateway's `resolveLabels`/`relabel` methods in full); and durations
  only count the one meter (API-key traffic) that records a real
  `latencyMs` — chat and computer-session events are skipped, never
  bucketed as "unknown".
- `analyticsRules.ts` — window/group-by tab constants, copy, and
  `buildBreakdownCsv` (RFC 4180-quoted `key,requests,tokens,credits_pence`
  rows — the same columns and quoting web's own client-side `handleExport`
  produces).
- `analyticsApi.ts` — one query, `getAnalytics(days?)`. New `'Analytics'`
  tag registered in `src/store/api.ts`.

## Screen

`AnalyticsScreen.tsx`:

- Header note ("Data in UTC. Last activity {relative}." or "No activity
  in this window.") + a 7/30/90-day `StatusTabs` selector.
- Three `StatTile`s: Total credits (+ request count), Active days (+ "Of
  N in the window"), Avg credits per active day (a plain caption, no
  warning tone — web frames this as informational, not a threshold).
- A Model/Agent/Customer `StatusTabs` group-by selector + an Export
  button, opening `AnalyticsExportSheet`.
- The daily cost chart — **reuses `CreditsBarChart` directly** from the
  Usage & Credits feature rather than forking it: `daily`'s shape here is
  byte-for-byte identical (`{date, costCents, tokens, requests}`, both
  zero-filled server-side the same way) and web's own chart for this tab
  is likewise a single cost-only series, so there was no behavioral
  reason to duplicate an already-correct ~55-line component. `StatTile`
  and `StatusTabs` are already shared this same way across every
  reporting-style module in this app.
- The selected breakdown as a `FlatList` of Card rows (key, requests,
  tokens, credits) — web's `DataTable` equivalent, matching every other
  module's established row-list idiom (no table primitive exists in this
  app).
- A **Task durations** section, rendered only when
  `durationsMeasuredRequests > 0` (never an empty-state card for it,
  matching web exactly) — five fixed latency buckets as rows, with a
  "Covers X of Y requests…" caption shown only when coverage is partial.

### Export

Web's export is genuinely real (not mock): a client-side CSV built from
whichever breakdown is currently selected, in `useReportingTabs.tsx`'s
`handleExport`. Mobile has no `<a download>`/blob-URL mechanism, so
`AnalyticsExportSheet` follows the same adaptation Usage & Spend's export
already established for this exact constraint (no `expo-sharing`/
`expo-file-system` dependency in this app): show the CSV in a preview and
offer "Copy full CSV" via the clipboard. Unlike Usage & Spend's export,
this one needs no network call or loading state at all — the CSV is
built synchronously from data already on screen, so the sheet opens
already showing it.

### Nothing mock, nothing to leave out

Confirmed directly from the current web source (not just the backend's
doc-comment): no dead buttons, and no lingering artifacts/connectors/
skills/projects UI anywhere in this tab — only explanatory comments about
their historical removal remain. No `CUSTOMER_PERMISSIONS`/agent-specific
gating exists or is needed client-side for the `byCustomer`/`byAgent`
name resolution — that fail-soft behavior is entirely server-side and
invisible to the HTTP response.

## Permissions

No route-level gate. `usage.view` (`USAGE_PERMISSIONS.VIEW`) gates the
three headline stats and every row's credits column; requests/tokens
counts and the breakdown/duration structure itself are always visible,
matching web (which gates only the money cells via `MoneyValue`, not the
whole table).

## Definition of Done

- [x] Data layer: types, rules, API
- [x] Header note, window selector, three stat tiles
- [x] Group-by selector, daily chart (reused), breakdown list
- [x] Export sheet (client-built CSV, clipboard copy)
- [x] Task durations section (conditional on real coverage)
- [x] Permission gating on money, not the route (placeholder's bug fixed)
- [x] Navigation wired (`SettingsStack.tsx`), home sublabel corrected
- [x] Old placeholder removed
- [x] `tsc --noEmit` clean
- [x] `expo export --platform ios` clean
- [x] This spec
