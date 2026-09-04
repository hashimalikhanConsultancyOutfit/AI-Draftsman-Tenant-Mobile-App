export const PAGE_DESCRIPTION =
  'Updates routed to "In app" under your notification settings. A category set to email went to your inbox instead, and one set to off produced nothing here.';

export const EMPTY_TITLE = 'Nothing here yet';
export const EMPTY_DESCRIPTION =
  'Updates appear here for any category set to "In app" in your notification preferences.';

export const MARK_ALL_READ_ERROR = 'Could not mark everything as read.';

/**
 * The dot's colour, by category — ported from web's `NotificationBell`
 * `CATEGORY_META` (same three keys, same colour mapping onto this app's
 * own theme tokens rather than MUI's `*.main` palette entries). Colour
 * alone distinguishes them, matching web's own reasoning: a repeated text
 * label down every row of a tray that's mostly one kind of thing adds
 * noise the card's own title/body already resolves.
 */
export const CATEGORY_META: Record<string, { label: string }> = {
  ACTIVITY_UPDATES: { label: 'Activity & updates' },
  SCHEDULED_TASKS: { label: 'Scheduled tasks' },
  USAGE_CREDITS: { label: 'Usage & credits' },
};

export function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? category;
}

/** "just now" / "14 min ago" / "3 h ago" / "3 Feb" — same buckets as web's `formatWhen`. */
export function formatNotificationWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = (Date.now() - then) / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} d ago`;

  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
