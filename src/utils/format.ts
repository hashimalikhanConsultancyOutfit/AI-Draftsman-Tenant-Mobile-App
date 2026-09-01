/**
 * Formatting helpers. Money units are NOT uniform across the API — confirmed
 * against live responses on 2026-08-31:
 *
 *   GET /dashboard  -> decimal pounds  (summary.spend: 3.04, spendCap: 5)
 *   GET /limits     -> integer pence   (capCents: 500, spentCends: 304)
 *
 * Two formatters below on purpose, so a call site can't silently apply the
 * wrong one — `formatMoney` for decimal-pound fields, `formatMoneyCents`
 * for *Cents fields. Mixing them up is exactly the trap the API docs flag.
 */

export function formatMoney(amount: number | undefined, currency = 'GBP'): string {
  if (amount === undefined) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

export function formatMoneyCents(cents: number | undefined, currency = 'GBP'): string {
  if (cents === undefined) return '—';
  return formatMoney(cents / 100, currency);
}

/** "860.6k", "1.2M" — for token counts. */
export function formatCompactNumber(n: number | undefined): string {
  if (n === undefined) return '—';
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(n: number | undefined): string {
  if (n === undefined) return '—';
  return new Intl.NumberFormat('en-GB').format(n);
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

/** "6 Aug", used for spend-by-day axis labels. */
export function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "2026-08" -> "August 2026" — the dashboard's month filter and its
 * period-scoped captions. */
export function formatMonthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  const d = new Date(year, month - 1, 1);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** "3 days ago", "6 h ago", "just now" — for recent-run timestamps. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  const months = Math.floor(days / 30);
  return `${months} mo ago`;
}
