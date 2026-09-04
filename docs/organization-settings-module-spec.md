# Organization settings module — spec

Phase 14's last piece. Ported from web's `src/features/OrganizationSettings/`
and the gateway's `apps/gateway-b2b/src/app/organization/organization.
controller.ts`, confirmed against that source on 2026-09-04.

## Scope

One screen, two numbers and their difference: what a credit costs this
workspace (£1, by definition — `costPencePerCredit` is always 100, read
from the response rather than hardcoded), what it charges its customers
for one (`sellPencePerCredit`, nullable — never set is not the same as
free), and the margin between them. All three, plus this period's
consumption/revenue/margin, come from one `GET /organization/pricing`
read; the only write is `PUT /organization/pricing/credit-rate`.

The margin is never recomputed client-side — it arrives already
subtracted, on both the per-credit rate and the period summary, because a
second implementation of that arithmetic is free to disagree with the one
the invoice is built from. The period's margin is specifically NOT
`sellCents − costCents` either: it is sell minus the cost of the RESOLD
credits only, so a workspace's own internal usage never shows up as pure
loss with the real resale margin buried inside it.

## Screens

- `OrganizationSettingsScreen` — the read. `billing.view` gates the whole
  screen (a refusal EmptyState otherwise); a failed read (query error)
  renders a separate "Pricing is unavailable" EmptyState rather than
  zeros, because a £0 margin is something a tenant would act on and it
  would not be true. Three stat tiles for the per-credit figures ("You
  pay" / "You charge" / "You keep", the margin tile coloured by sign), an
  info banner naming which other pricing mechanism is in effect when no
  per-credit rate is set (`flat` / `markup` / the legacy `tokenRate`), and
  a period panel that is itself three-way: unavailable (ledger unreadable
  — null, not zero), empty (nothing charged yet), or four more stat
  tiles.
- `CreditRateFormScreen` — the one write, a modal pushed from "Set/Change
  selling rate". One field, prefilled with the current rate in pounds
  (blank, not `0.00`, when never set — a blank field asks the question
  rather than suggesting an answer). Validated to mirror
  `SetCreditRateDto` exactly: non-negative, at most two decimal places,
  capped at `MAX_SELL_PENCE_PER_CREDIT` (£1,000 — a unit-check ceiling
  against pounds typed into a pence-scale field, not a real price anyone
  means to set).

## The visible-but-disabled button

`billing.manage` gates the ability to save a new rate, but the
"Set/Change selling rate" button is never hidden for lacking it — only
disabled, with a caption naming the missing permission underneath. This
mirrors web's own explicit choice (stated in its source): it is the only
place in the whole portal to set a selling rate, so an absent button
would read as a missing feature rather than a missing permission. Every
other module built so far in this app hides its primary action when the
gating permission is absent (Team's "Invite member", Roles' "Add role");
this is a deliberate, disclosed exception to that pattern because the
web source calls out the same exception for the same reason.

## Deliberate, disclosed deviations

- **`formatPeriod` does not reuse `@/utils/format`'s `formatMonthLabel`.**
  That helper builds a local-time `Date` from the `YYYY-MM` key, which
  mislabels the period as the previous month for anyone west of Greenwich
  once the 1st-of-the-month UTC timestamp rolls back a day locally. Web
  hit this exact bug and fixed it by parsing as UTC and pinning to the
  2nd of the month; `organizationSettingsRules.ts`'s own `formatPeriod`
  ports that fix rather than reusing the existing (differently-correct)
  mobile helper.
- **`MAX_SELL_PENCE_PER_CREDIT` is restated, not imported.** The web
  client and the backend DTO both read it from `@b2b/shared/tokens`, a
  backend-only workspace package mobile has no path to. `pricingLimits.ts`
  restates the same value (100,000) with a note to keep it in sync if the
  shared constant ever changes — the same restated-constant pattern
  already used elsewhere in this app where a shared backend package isn't
  reachable from React Native.
- **`StatTile` gained one additive prop.** `valueTone?: 'positive' |
  'negative' | null`, colouring the tile's own value text (not just its
  caption) — needed here because web colours the margin figure itself,
  not only the note beneath it. Every existing call site (Dashboard,
  Customers, Company Agents, Leads) omits the prop and is visually
  unchanged.

## Permission slugs

`billing.view` / `billing.manage` — both already present in
`src/permissions/slugs.ts` (`BILLING_PERMISSIONS`) before this module was
built. `billing.topup` is unrelated to this screen (it gates moving money
in, not the resale rate) and untouched.

## Definition of Done

- [x] Every web view has a mobile destination (read screen + rate-editor
      modal)
- [x] Every figure's null-vs-zero distinction preserved (no rate set,
      ledger unreadable, period genuinely empty — three different states,
      never flattened to £0)
- [x] The one form field's server validation bounds mirrored exactly
- [x] Permission gates applied, including the deliberate
      visible-but-disabled exception for the primary action
- [x] Pull-to-refresh, loading and unavailable states
- [x] Documented error codes handled via `getErrorMessage`
- [x] Success behaviour: toast text, navigation back, cache invalidation
- [x] `tsc --noEmit` clean, `expo export` clean
- [ ] Tested on a real device as owner and as a role with `billing.view`
      but not `billing.manage`
- [ ] Dark mode pass
