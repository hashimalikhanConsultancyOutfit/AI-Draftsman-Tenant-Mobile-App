# Phase 11 — Leads + Lead criteria: build spec and traceability

Built 3 Sep 2026, following the Chat/Customers precedent: ported directly
from primary source, not from the deliverable docs. Sources read in full:
web's `src/features/Leads/**`, `src/features/LeadCriteria/**`,
`src/store/api/leads.api.ts`, `src/store/api/leadCriteria.api.ts`,
`src/types/lead.types.ts`, `src/types/leadCriteria.types.ts`, and the
backend's `apps/gateway-b2b/src/app/leads/leads.controller.ts` and
`apps/gateway-b2b/src/app/lead-criteria/lead-criteria.controller.ts`.

---

## 1. Leads (`/leads`, `lead.view` + `lead.create`/`lead.update`/`lead.score`/`lead.delete`)

### API contract (confirmed against backend source)
| Method | Path | Notes |
|---|---|---|
| GET | `/leads` | `skip`/`take`, default 100, capped 500 |
| GET | `/leads/stats` | server-aggregated `{total, open, scored, unscored, won}` |
| GET | `/leads/:id` | |
| POST | `/leads` | `score` only together with `why`; `leadType` never sendable |
| PATCH | `/leads/:id` | same score/why pairing rule |
| DELETE | `/leads/:id` | `lead.delete`, its own catalogue row |
| POST | `/leads/:id/stage` | `{stage}` XOR `{direction: 'forward'\|'back'}` |
| POST | `/leads/score` | fire-and-forget, `202 {accepted:true}` — no run to poll, invalidates nothing |
| POST | `/leads/crm-push` | preview only, `delivered` always false today, 409 with no CRM connector |
| GET/POST/GET/DELETE | `/leads/:id/attachments[...]` | max 10/lead per batch, 15MB/file, PDF/PNG/JPEG/WebP/DOC/DOCX |

Realtime: `lead:evaluation-completed` on the same shared `/chat` socket
(tenant-wide broadcast, not conversation-scoped) — the board **refetches**
on this frame via `onChatSocketEvent`, never patches a score locally. No
REST poll exists or is needed beyond that.

### Mobile deviations from web (deliberate, disclosed)
- **No drag-and-drop Kanban.** The web board itself never required drag —
  its cards carry the same forward/back arrows mobile uses
  (`LeadBoardProps.onMove`). Mobile replaces the five-column board with a
  segmented stage picker + one stage's list at a time (build-plan §5.4's
  own suggested shape: "paged stage columns").
- **Reasoning table is its own pushed screen** (`LeadReasoningScreen`),
  reached from the Leads screen's header actions, rather than a section
  stacked below the board — there is no room on a phone to show a full
  stage list and an audit table on one screen at once.
- CRM push preview result shows as a native `Alert`, not an inline panel
  — it is a one-off preview, not persisted state.

### Definition of Done
- [x] Every web route has a mobile destination: list/board → `LeadsScreen`;
      detail dialog → `LeadDetailScreen`; create/edit → `LeadFormScreen`;
      reasoning table → `LeadReasoningScreen`.
- [x] Stats (open/scored/unscored/won), stage picker with per-stage counts.
- [x] Score/why pairing validated client-side, matching the server's rule.
- [x] Every permission gate: `lead.view` (screen), `lead.create` (Add lead),
      `lead.update` (edit, move, attachments-remove, CRM push preview),
      `lead.score` (Run scoring), `lead.delete` (Delete).
- [x] Won-exit confirmation (`Alert`) mirrors web's `pendingMove` dialog.
- [x] Attachments: list, open (minted URL), remove (confirm), upload from
      the create/edit flow deferred to the detail screen (lead must exist
      first — matches web's own two-step shape).
- [x] Socket-driven board refresh on `lead:evaluation-completed`, toast
      worded identically to web's `describeLeadEvaluationCompleted`.
- [ ] Real-device test across owner/member/custom role — pending device
      access (blocked the same way Chat's live-bug verification was:
      no OTP-login capability from this environment).
- [ ] Dark mode pass — built against the same theme tokens as
      Customers/Chat, not yet screenshotted on-device.

---

## 2. Lead criteria (`/lead-criteria`, `lead_criteria.view` + `lead_criteria.manage`)

Its own two permissions — NOT `lead.view`/`lead.update` — confirmed on
both the gateway (`RequiresPermission(LEAD_CRITERIA_PERMISSIONS.*)`) and
the web hook. Stored-only today: nothing reads these rows yet (no scoring
integration, no lead-search execution) — the mobile copy says so
verbatim where web does, so this screen never implies a capability that
does not exist.

### API contract
| Method | Path | Notes |
|---|---|---|
| GET | `/lead-criteria` | paged (`page`/`limit`/`search`/`status`), archived excluded unless `status=ARCHIVED` |
| GET | `/lead-criteria/:id` | carries `evaluationCriteria[]`; the list shape omits it for a count instead |
| POST | `/lead-criteria` | no `status` key accepted — a set is always born ACTIVE |
| PATCH | `/lead-criteria/:id` | every field optional; omit = unchanged, `null` = clear |
| DELETE | `/lead-criteria/:id` | cascades its rules |
| POST/PATCH/DELETE | `.../evaluation-criteria[/:criterionId]` | 400 past 50 rules; rules ride the parent set's own detail read, no separate list endpoint |

### The 25-field, 6-section form
Ported field-for-field from `LeadCriteriaFormDialog.tsx`/`.data.ts`:
**Identity** (name, description, status[edit-only]) · **Firmographics**
(industries, countries, regions, companyTypes — closed multi-selects;
employeeCountMin/Max, annualRevenueMin/Max as a plain decimal string,
revenueCurrency) · **Contact targeting** (jobTitles, seniorities,
departments) · **Keywords & exclusions** (includeKeywords,
excludeKeywords, excludeDomains, technologies — free-text tag arrays) ·
**Signals & intent** (fundingStages, hiringSignal, recentFundingWithinDays,
sources) · **Thresholds** (minScore, autoQualifyScore ≥ minScore).

Validation mirrors the web's Yup schema exactly, including the two
cross-field rules (`employeeCountMax ≥ Min`, `autoQualifyScore ≥
minScore`) and the currency/decimal-string patterns.

### Mobile deviation from web (deliberate, disclosed)
- **One scrollable form with 6 section headers, not a literal stepper.**
  The build plan flagged this field count as "genuinely awkward" and
  proposed a stepper; this app has no stepper/wizard component yet, and
  every other multi-section mobile form in this codebase (e.g.
  `ChatThreadDetailsScreen`) uses the same single-scroll-with-headers
  shape. Functional parity is complete — every field is present and
  validated identically — the interaction is the one difference.
- Two new shared form primitives were built for this screen and are
  reusable by any future multi-select/tag-array need:
  `components/ui/PickerField.tsx` (single-select sheet) and
  `features/lead-criteria/components/{MultiSelectField,TagArrayField}.tsx`.

### Definition of Done
- [x] Registry: search (debounced, server-side), archived toggle,
      pagination ("Load more"), permission-gated create/edit/rules/delete.
- [x] Facet-preview chips + headcount label on each card, ported from
      `LeadCriteriaCard.data.ts`.
- [x] Full create/edit form, all 25 fields, 6 sections, cross-field
      validation.
- [x] Rules screen: add/edit/remove, weight bound (-100..100) checked
      client-side before the request (matches web's own pre-check ahead
      of the server's 400), `EXISTS` operator hides the Value field.
- [x] `lead_criteria.manage` gates every write; `lead_criteria.view`
      gates the screen itself.
- [ ] Real-device test across roles — pending device access.
- [ ] Dark mode pass — pending on-device screenshot.

---

## 3. Files added

```
src/features/leads/
  leads.types.ts  leadsApi.ts  leadsRules.ts
  schemas/leadFormSchema.ts
  components/LeadCard.tsx
  LeadsScreen.tsx  LeadDetailScreen.tsx  LeadFormScreen.tsx  LeadReasoningScreen.tsx
src/features/lead-criteria/
  leadCriteria.types.ts  leadCriteriaApi.ts  leadCriteriaRules.ts  leadCriteriaOptions.ts
  schemas/leadCriteriaFormSchema.ts  schemas/evaluationRuleSchema.ts
  components/{LeadCriteriaCard,MultiSelectField,TagArrayField}.tsx
  LeadCriteriaScreen.tsx  LeadCriteriaFormScreen.tsx  LeadCriteriaRulesScreen.tsx
src/components/ui/PickerField.tsx   (new shared primitive)
src/navigation/stacks/{LeadsStack,LeadCriteriaStack}.tsx
```

`src/navigation/types.ts` and `src/navigation/AppDrawer.tsx` updated to
route through the new stacks instead of the `ModulePlaceholderScreen`
stubs; `src/store/api.ts` gained the `Lead`/`LeadAttachment`/
`LeadCriteria`/`LeadEvaluationCriterion` cache tags.

**Verified:** `tsc --noEmit` clean; `expo export --platform ios
--no-bytecode` bundles cleanly (1574 modules). Not yet verified: on
real device, across roles, in dark mode — see the two Definition of Done
lists above.
