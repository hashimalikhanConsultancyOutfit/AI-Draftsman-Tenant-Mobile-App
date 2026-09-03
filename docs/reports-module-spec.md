# Reports module — spec

Ported from `ai-draftsman-FE-B2B/src/features/Reports/**` and
`ai-draftsman/apps/gateway-b2b/src/app/reports/**` (confirmed against that
source on 2026-09-03). Scheduled analytics exports: a registry, a
frequency-driven schedule builder, run-now with polling, a per-report run
log, and file download.

## API contracts

| Action | Method | Route | Notes |
|---|---|---|---|
| List reports | GET | `/reports?page&limit` | `{ items, total, page, limit, totalPages }`. |
| One report | GET | `/reports/{id}` | Seeds the edit form — the registry list is paginated, so a report opened for edit may not still be in that query's cache. |
| Create | POST | `/reports` | `{ name, dims[], dest, destDetail?, frequency, runAtMinute, dayOfWeek, dayOfMonth, monthOfYear, intervalDays, customStartAt }` — every schedule field the chosen frequency doesn't use is sent as explicit `null`, never omitted (an absent key on a later PATCH means "leave alone"). |
| Update | PATCH | `/reports/{id}` | Same body shape. Takes effect from the next run; does not backfill. |
| Delete | DELETE | `/reports/{id}` | Removes the schedule; past runs and delivered exports are untouched. |
| Run now | POST | `/reports/{id}/run` | 202 + `{ runId, replayed }`. Does not wait for the run to finish. |
| Run history | GET | `/reports/{id}/runs?page&limit` | Own cache tag per report (`runs-{id}`), keyed on the id alone so a manual run's invalidation reaches whichever page is on screen. |
| Download link | GET | `/reports/{id}/runs/{runId}/download` | `{ url, filename, expiresInSeconds }` — a signed link, never the bytes; not cached (RTK mutation, same reasoning as Leads' `getLeadAttachmentUrl`). Opened with `Linking.openURL`. |

Permissions, all four from `report.*`: `report.view` gates the screen,
`report.manage` gates create/edit, `report.run` gates Run now (a separate
grant from editing a schedule — queues chargeable work), `report.delete`
gates delete, `report.download` gates the file (separate from run — reading
a file that already exists is not the same action as producing a new one).

## Deliberate mobile deviations

- **Date and time are validated text fields (`YYYY-MM-DD`, `HH:MM`), not a
  native calendar/clock picker.** This app has no date/time picker
  component and none of its dependencies provide one; adding
  `@react-native-community/datetimepicker` (or similar) is a new native
  module needing a dev-client rebuild this environment can't perform or
  verify. The typed fields carry exactly what web's own native
  `<input type="date">` / `<input type="time">` produce underneath,
  validated against the same shapes and the same server bounds. Worth
  revisiting once a rebuild is in hand — flagged rather than silently
  decided either way, per the build plan's own §5.4 (Playground/Reports were
  both called out as needing a real decision, not an assumption).
- **`MultiSelectField` promoted from Lead criteria to `@/components/ui`.**
  Its own doc comment already said as much ("promoted to a shared
  `components/ui` primitive if a second feature needs it") — Reports'
  "Group by" field is that second feature. Moved, not duplicated; Lead
  criteria's six call sites now import the shared component.
- **Registry and run log both use "Load more"**, not numbered pages —
  matching the fix just made to Playground and the pattern already
  established by Lead criteria's own registry, rather than web's
  `DataTable` + `TablePager`.
- **Run-now polling reuses `dispatch(reportsApi.endpoints.getReportRuns.initiate(...))`**,
  the same store-level re-read (bypassing the cache, `subscribe: false`) web
  uses in its own `handleRunNow` — RTK Query's `initiate`/`unwrap` pattern is
  store-agnostic, so this ports unchanged.
- **Download opens the signed URL via `Linking.openURL`**, the same
  mechanism Leads already uses for attachments, rather than web's
  `window.location.assign` (there is no browser navigation to redirect on
  mobile — the OS hands the URL to whatever can open it, typically the
  share sheet or the default browser's own download handling).

## Definition of done

- [x] `tsc --noEmit` clean
- [x] `expo export --platform ios --no-bytecode` clean (1587 modules)
- [x] Every permission gate applied: `report.view` (screen), `report.manage`
      (create/edit), `report.run` (Run now + toast), `report.delete`
      (delete + confirm), `report.download` (Download + toast)
- [ ] Tested on a real device as owner, member, and one custom role
- [ ] Dark mode pass

## Files

**New:**
- `src/features/reports/reports.types.ts`
- `src/features/reports/reportsApi.ts`
- `src/features/reports/reportsRules.ts`
- `src/features/reports/schemas/reportFormSchema.ts`
- `src/features/reports/components/ReportCard.tsx`
- `src/features/reports/ReportsScreen.tsx` (overwrote the
  `ModulePlaceholderScreen`-based stub)
- `src/features/reports/ReportFormScreen.tsx`
- `src/features/reports/ReportLogsScreen.tsx`
- `src/navigation/stacks/ReportsStack.tsx`
- `src/components/ui/MultiSelectField.tsx` (moved from
  `src/features/lead-criteria/components/`)

**Edited:**
- `src/components/ui/index.ts` — exports `MultiSelectField`.
- `src/features/lead-criteria/LeadCriteriaFormScreen.tsx` — imports
  `MultiSelectField` from `@/components/ui` instead of its old local path.
- `src/features/lead-criteria/components/MultiSelectField.tsx` — now a
  one-line re-export of the shared component (this device bridge can't
  delete files; kept as a compatibility shim rather than a duplicate
  implementation).
- `src/store/api.ts` — added `'Report'` to `tagTypes`.
- `src/navigation/types.ts` — added `ReportsStackParamList`; the drawer's
  `Reports` entry now carries `NavigatorScreenParams<ReportsStackParamList>`.
- `src/navigation/AppDrawer.tsx` — `Reports` drawer screen now mounts
  `ReportsStack` instead of `ReportsScreen` directly.
