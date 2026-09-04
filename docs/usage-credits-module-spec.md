# Usage and credits module — spec

## Scope

The workspace's wallet: balance, grants and metered spend. Mobile's
equivalent of web's `MySettings` dialog's `usage-credits` tab
(`UsageCreditsPanel`). A Settings sub-screen (`SettingsStack`'s
`UsageCredits` route), replacing the pre-existing placeholder.

**Important — this is a different surface from the earlier "Usage and
spend" drawer module.** That module (`src/features/usage-spend/`) is a
workspace-wide breakdown by model/customer/agent/key, backed by
gateway-b2b's own `GET /usage`. This module is the wallet view, backed by
`GET /auth/my-settings/usage-credits`, answered by an entirely different
backend service (**b2b-billing**, not gateway-b2b's usage controller).
The two were confirmed as genuinely separate surfaces by tracing both to
their real controllers before writing any code — the placeholder's own
description ("from GET /limits") was itself wrong and pointed at a third,
unrelated endpoint (a not-yet-built "Billing & Pricing" module's spend
cap, which really does exist and really does charge Stripe on top-up, but
belongs to a different mobile screen that doesn't exist yet).

## Data layer

- `usageCredits.types.ts` — `CreditSummary`, `CreditGrant`,
  `UsageHistoryRow`, `DailyUsagePoint`, confirmed field-for-field against
  `settings.controller.ts`'s `getUsageCredits` and b2b-billing's real
  `insights.service.ts::getCreditSummary` (not just the DTO's Swagger
  comment — both agreed this time). Documents three real characteristics
  of the endpoint that aren't obvious from the type alone: every money
  field is integer pence and £1 = 1 credit (so `formatMoneyCents` states
  both facts in one figure); `seatUsedCents` is hard-coded `null` forever
  (the ledger has no per-seat attribution); and `grants` is drawn from
  only the wallet's last 100 transactions, so a very old grant can be
  silently excluded from both the list and the totals derived from it —
  a real characteristic of the backend, not a client bug to work around.
- `usageCreditsRules.ts` — copy (unfunded-wallet banner, seat-not-tracked
  caption, the "credits are pounds" note), the `GRANT_TYPE_LABEL` map
  (`GRANT`→"Opening grant", `TOPUP`→"Top-up"), `isLowBalance`, and the
  7/30/90-day window tabs.
- `usageCreditsApi.ts` — one query, `getUsageCredits(days?)`, hitting
  `GET /auth/my-settings/usage-credits`. New `'UsageCredits'` tag
  registered in `src/store/api.ts` (distinct from the existing `'Usage'`
  tag, which belongs to the other module, and `'Limits'`/`getLimits` in
  `dashboardApi.ts`, which is fully typed but has zero call sites
  anywhere in the app — confirmed unused before deciding not to reuse it
  here, since it models the unrelated `/limits` endpoint).

## Screen

`UsageCreditsScreen.tsx`, four sections mirroring web's `UsageCreditsPanel`:

- **Credit usage** — three `StatTile`s (Org credits used / of granted,
  Seat credits used, Remaining balance with a warning tone at or below
  the low-balance alert), plus the "credits are pounds" caption and an
  unfunded-wallet banner when `walletProvisioned` is false.
- **Credit grant** — a Card-wrapped row list (type, date, amount) rather
  than web's `DataTable` — this app has no table primitive; every other
  module's lists are Card rows (`UsageRowCard`, `TicketDetailScreen`'s
  attachment rows), so this follows that same idiom.
- **Credit usage history** — a 7/30/90-day `StatusTabs` selector (reused
  as-is, the same generic pill-tabs component Usage & Spend and API Keys
  already use) plus a new `CreditsBarChart` component, modeled directly
  on `DashboardScreen`'s own local `MiniBarChart` (this app's one
  existing chart idiom — plain `View`s, no chart library) rather than
  inventing a second charting approach.
- **Sessions** — a `FlatList` of Card rows (model, agent or "No agent",
  date, cost), matching web's session table's columns exactly (the wire
  type carries more fields — `providerServed`, `cachedTokens`,
  `latencyMs`, `tokens`, `customerRef` — than either platform's UI
  renders, by design; the type is the full contract, the screen is a
  subset).

### Permission gating: the screen is ungated, the money is not

Confirmed directly from web's `MySettings.data.ts`: `usage-credits` sits
in the ungated "account" nav group, reachable by any signed-in member —
there is no server-side permission guard on the route either. What's
gated is the money itself: `usePermission(USAGE_PERMISSIONS.VIEW)`
("Can view spend and usage figures") controls whether each amount renders
or shows an em-dash with a "Needs the 'View usage' permission" caption —
exactly the pattern `DashboardScreen`'s own `canSeeMoney` already
established, reused here rather than inventing a second convention for
the same idea.

### No mock-only features to exclude

Unlike several earlier modules (Usage & Spend's export dialog,
Personalization/Memory panels), `UsageCreditsPanel` has no dead buttons —
no "buy more credits" or "request a higher cap" anywhere in this tab (that
functionality genuinely exists, but lives entirely in the separate,
not-yet-built Billing & Pricing module against `/limits`, and is a real
Stripe-backed flow, not fake — just out of scope here). This panel is a
straight, complete 1:1 port with nothing to leave out.

## Permissions

No route-level gate. `usage.view` (`USAGE_PERMISSIONS.VIEW`) gates every
money value on the screen; no new permission slug was needed.

## Definition of Done

- [x] Data layer: types, rules, API
- [x] Credit usage stat tiles + unfunded banner
- [x] Credit grant list
- [x] Credit usage history (range selector + bar chart)
- [x] Sessions list
- [x] Permission gating on money, not the route
- [x] Navigation wired (`SettingsStack.tsx`)
- [x] Old placeholder removed
- [x] `tsc --noEmit` clean
- [x] `expo export --platform ios` clean
- [x] This spec
