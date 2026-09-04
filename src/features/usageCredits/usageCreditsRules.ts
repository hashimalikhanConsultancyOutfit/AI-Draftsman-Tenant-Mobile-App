/**
 * Usage and credits — copy constants and pure helpers. Ported from web's
 * `UsageCreditsPanel.tsx` (confirmed against that source 2026-09-04).
 */

import type { UsageCreditsWindow } from './usageCredits.types';

export const PAGE_DESCRIPTION = 'Your workspace balance, grants and metered spend.';

/** States the £1 = 1 credit rule once, the same reason web's caption
 * gives: a workspace that bought "100 credits for £100" needs to be told
 * once that the money figure in front of them is those credits, not a
 * second separate number. */
export const CREDITS_ARE_POUNDS_NOTE = 'Credits are held in pounds (£). One credit is £1, so every figure below is both an amount and a credit count.';

export const UNFUNDED_TITLE = 'No wallet yet';
export const UNFUNDED_MESSAGE = 'This workspace has no wallet yet, so there is nothing to report. A wallet is created when the workspace is provisioned or the first payment lands.';

export const SEAT_NOT_TRACKED_CAPTION = 'Not tracked — usage is attributed to API keys, not to people';

/** What the grant table's `type` column says, in the user's words. */
export const GRANT_TYPE_LABEL: Record<string, string> = {
  GRANT: 'Opening grant',
  TOPUP: 'Top-up',
};

export function grantTypeLabel(type: string): string {
  return GRANT_TYPE_LABEL[type] ?? type;
}

export function isLowBalance(summary: { balanceCents: number; lowBalanceAlertAtCents: number }): boolean {
  return summary.balanceCents <= summary.lowBalanceAlertAtCents;
}

export const WINDOW_TABS: { label: string; value: UsageCreditsWindow }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export const DEFAULT_WINDOW: UsageCreditsWindow = 30;

export const NO_GRANTS_TITLE = 'No credit grants yet';
export const NO_GRANTS_MESSAGE = 'Grants and top-ups appear here as they are applied to the wallet.';

export const NO_HISTORY_TITLE = 'No usage yet';
export const NO_HISTORY_MESSAGE = 'Individual requests appear here once agents start running.';

export const NO_DAILY_TITLE = 'No spend yet';
export const NO_DAILY_MESSAGE = 'Daily usage appears here once agents start running.';
