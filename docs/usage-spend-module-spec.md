# Usage & spend module — spec

Phase from the 17-module build plan. Ported from web's
`src/features/UsageSpend/` and the gateway's
`apps/gateway-b2b/src/app/usage/*`, both read in full and confirmed
against source on 2026-09-04.

## Scope

`GET /usage`, grouped by model, customer, agent or key, for the current
calendar month — the only window either platform offers (the rollup
table has no day-grain column, and web itself has no period picker). Six
stat tiles and a breakdown list, re-flowing web's `UsageTable`. One
export action against the real `POST /usage/export` route.

A documentation note worth recording: `UsageRowDto`'s own Swagger
description still claims `label` is "the raw key" and `cached` is
"always `null`", both stale — the controller's actual code (read in
full) resolves customer/agent/key ids to names via in-memory RPC lookups
and derives a real cache-hit percentage from `cachedTokens`. This build
follows the controller, not the out-of-date doc comment on the DTO.

## Screens

- `UsageSpendScreen` — `usage.view` gates the whole screen (already true
  of the placeholder this replaces). Six `StatTile`s (Month to date,
  Projected, Cached savings, Charged to your customers, Your margin,
  Unbilled failures — the last a plain count, never rendered as money,
  matching web's own explicit correction of an earlier bug where a
  hardcoded £6.15 sat beside a genuine count), a `StatusTabs` row for the
  four dimensions, and a card per breakdown row (label — relabelled when
  `(none)`/unattributed — requests, tokens, a cache-hit bar or an em dash
  when never measured, and cost). Pull-to-refresh; no polling — usage is
  server-derived and nothing else in this app writes to it, so there is
  nothing to poll for between explicit refreshes.

## Export — a real, narrower flow than web's

Web's export dialog (`EXPORT_FIELDS`: format CSV/JSON/PDF, group,
range, "include cost") calls no backend at all —
`useUsageSpend.tsx`'s `handleSubmitExport` only shows a
"queued" toast and never reaches `usage.api.ts`. The one route that
actually exists, `POST /usage/export`, is narrower than every one of
those fields: CSV only, one calendar month, a fixed grouping (key,
model, customer) baked into the query. Porting web's form would mean
building four controls that do nothing, which is the same category of
problem this session already declined to ship once (Branding's
excluded, mock-only fields).

So `ExportSheet` calls the real route for the current month and
presents the result honestly: a row count, a preview of the first 12
lines, and a "Copy full CSV" button (`expo-clipboard`, the same library
already used for domain-record and invite-link copies elsewhere in this
app). The file itself is not saved or shared — this app has no
`expo-sharing`/`expo-file-system` dependency yet — so getting it into a
spreadsheet is a copy-and-paste rather than a share-sheet. Worth
revisiting if that dependency is ever added for another module.

`usage.export` gates the Export button — shown disabled with a caption
rather than hidden, mirroring web's own disabled-button-plus-tooltip
choice and its stated reason: Export is the only action on this screen,
so an absent button would read as a missing feature rather than a
permission somebody could ask for. The same exception class as
Organization Settings' rate button and Branding/Domain's per-row
actions.

`POST /usage/export` returns `text/csv`, which the shared `apiRequest`
helper cannot carry (it only parses `application/json`, resolving
anything else to `undefined`) — so `usageExport.ts` bypasses it with a
raw `fetch` carrying the same cookie header, the same bypass shape
`csvUpload.ts` already established for its own non-JSON traffic.

## Permissions

`USAGE_PERMISSIONS`: `VIEW` gates the screen, `EXPORT` gates the Export
button alone — a separate catalogue row on the real backend precisely
because reading figures on screen and taking a copy away are different
grants.

## Definition of done

- [x] `usageSpend.types.ts` mirrors `usage.dto.ts` and web's
      `usage.api.ts` types exactly (both read in full).
- [x] `usageSpendRules.ts` — tabs, copy, the unattributed-row relabel,
      and the month-end projection math ported as real logic (not the
      stale `0.7` constant web itself flags as a past bug).
- [x] `usageSpendApi.ts` — the one real query endpoint, tagged per
      dimension.
- [x] `usageExport.ts` — a real call to the one real export route, with
      its own raw-fetch bypass for the non-JSON response.
- [x] `UsageSpendScreen` built: tiles, tabs, card list, export sheet.
- [x] No navigation changes needed — the drawer already mounts this
      screen directly (no sub-screens; the module has no forms besides
      the export sheet).
- [x] `tsc --noEmit` clean.
- [x] `expo export --platform ios` clean.
- [x] This spec.
