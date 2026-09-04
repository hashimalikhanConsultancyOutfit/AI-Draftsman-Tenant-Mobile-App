/**
 * Organization settings — copy and pure helpers. Ported from web's
 * `OrganizationSettings.data.ts` (confirmed against that source
 * 2026-09-04). Money-from-pence formatting reuses `@/utils/format`'s
 * `formatMoneyCents` (already the same `Intl.NumberFormat` 2-decimal GBP
 * currency formatter web's `formatPerCredit`/`formatMoney` are) rather than
 * redefining it — everything below is what that helper does not cover:
 * signed margins, percentages, credit counts, and the UTC-safe period
 * label.
 */

import { MAX_SELL_PENCE_PER_CREDIT } from './pricingLimits';

export const toPounds = (pence: number): number => pence / 100;
export const toPence = (pounds: number): number => Math.round(pounds * 100);

/** The ceiling in pounds, for the form's own validation message — the
 * server's bound is in pence (see `pricingLimits.ts`). */
export const MAX_SELL_POUNDS_PER_CREDIT = MAX_SELL_PENCE_PER_CREDIT / 100;

/**
 * A margin, formatted with its sign.
 *
 * The `+` is explicit because a bare "£0.50" beside a cost figure reads as
 * another price rather than the difference between two. Negative margins
 * keep their minus — a workspace selling below cost is the case this
 * screen most needs to make obvious, not the one to round away.
 */
export const formatMargin = (cents: number): string => {
  const abs = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  return `${cents >= 0 ? '+' : '−'}${abs}`;
};

/** The margin as a percentage of what a credit costs. Null when a credit
 * somehow costs nothing — a percentage of zero is not a large number, it
 * is not a number. */
export const marginPct = (marginPence: number, costPence: number): number | null => (costPence > 0 ? (marginPence / costPence) * 100 : null);

export const formatMarginPct = (pct: number): string => `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}%`;

/** Credits, for display. Fractional credits are real — an action priced
 * at 250p a token consumes 2.5 of them — so up to two decimals are kept,
 * dropped when zero: "1,240 credits" reads as a count, "1,240.00 credits"
 * reads as money, which a credit is deliberately not. */
export const formatCredits = (credits: number): string => new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(credits);

/** Which way a margin figure is coloured, or null for "no rate set" / "no
 * margin to report" — a case that must never collapse into the same
 * branch as a zero margin (a workspace breaking even is a result; an
 * unanswered question is not). */
export const marginToneOf = (cents: number | null): 'positive' | 'negative' | null => {
  if (cents === null) return null;
  return cents >= 0 ? 'positive' : 'negative';
};

/**
 * `2026-08` -> `August 2026`.
 *
 * Parsed as UTC and pinned to the 2nd of the month — deliberately NOT
 * `@/utils/format`'s `formatMonthLabel`, which builds a local-time `Date`
 * and mislabels the period as the previous month for anyone west of
 * Greenwich when the 1st at UTC midnight rolls back a day locally. The key
 * here is a UTC `YYYY-MM`, so it must be read back as UTC.
 */
export const formatPeriod = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 2)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export const PAGE_DESCRIPTION = 'A credit costs you £1. What you charge your customers for one is yours to set, and the difference is what you keep.';

export const CREDIT_CARD_TITLE = 'What a credit costs, and what you charge';

export const PERIOD_CARD_TITLE = 'This period';

export const NO_RATE_COPY = {
  title: 'No selling rate set',
  description: 'Your customers are not being charged for credits. Until a rate is set, resold usage falls back to whatever per-customer or per-agent rule matches it, and to nothing at all when none does.',
} as const;

/** Shown when the workspace default prices some other way this screen
 * cannot edit. `tokenRate` matters most to say out loud: a workspace that
 * set per-million rates before credits shipped still has them and is
 * still being charged on them — "no rate set" would be wrong twice over. */
export const OTHER_MECHANISM_COPY = {
  flat: 'Your workspace default charges a flat price per call, set as a price override. Setting a price per credit below will replace it.',
  markup: 'Your workspace default charges a percentage markup on what the platform charges, set as a price override. Setting a price per credit below will replace it.',
  tokenRate: 'Your workspace default still charges the older per-million-token rate, which this screen no longer edits. It is still being applied to resold calls. Setting a price per credit below will replace it.',
} as const;

export const PERIOD_UNAVAILABLE_COPY = {
  title: 'This period’s figures are unavailable',
  description: 'The usage ledger could not be read, so no totals are shown. They are left out rather than defaulted — “you have sold no credits” and “we could not find out” lead to opposite decisions, and £0 would say the first.',
} as const;

export const PERIOD_EMPTY_COPY = {
  title: 'No credits consumed yet this period',
  description: 'Nothing has been charged since the period began, so there is no revenue or margin to report. Your rate applies from the next call.',
} as const;

export const NO_VIEW_DESCRIPTION = 'Seeing what a credit costs and what this workspace charges for one needs the "View billing" permission.';

export const UNAVAILABLE_COPY = {
  title: 'Pricing is unavailable',
  description: 'Your selling rate could not be read, so no figures are shown. They are left out rather than defaulted — a margin of £0 is something you would act on, and it would not be true.',
} as const;

export const NO_MANAGE_MESSAGE = 'Changing the selling rate needs the "Manage billing" permission.';

export const RATE_FORM_COPY = {
  createTitle: 'Set your selling rate',
  editTitle: 'Change your selling rate',
  description: 'A credit costs you £1.00. What you enter is what one credit costs your customer — £1.50 means you keep 50p on each. This applies to the next call; anything already billed keeps the rate it was charged at. Per-customer and per-agent rules are more specific and keep overriding this default.',
  fieldLabel: '£ per credit',
  fieldHint: 'What one credit costs your customer. Enter 0 to give credits away — a real choice, but a deliberate one.',
  submitLabel: 'Save rate',
} as const;

export const SAVED_TOAST = 'Selling rate saved. It applies to calls from now on — anything already billed keeps the rate it was charged at.';

/** `getErrorMessage`'s fallback for this screen's one write. */
export const RATE_SAVE_ERROR_FALLBACK = 'Could not save that rate.';
