/**
 * My Surveys — pure rules and copy, ported from web's `features/MySurveys`
 * (`MySurveys.data.ts`, `useMySurveys`, `useSurveyFill`, the fill
 * renderer's validation, and `mySurveyJourney.ts`).
 */
import type { MsSurveyWire, MySurveyAssignment, SurveyAssignmentStatus, SurveyField } from './surveys.types';
import type { Tone } from './surveysRules';

export const MY_SURVEYS_COPY = {
  title: 'My Surveys',
  description: 'Surveys your workspace has asked you to fill in.',
  listView: 'My surveys',
  mapView: 'Tube map',
  emptyTitle: 'Nothing assigned',
  emptyBody: 'Surveys sent to you will show up here.',
  errorTitle: 'Could not load your surveys',
  errorBody: 'The workflow service did not answer. Try again in a moment.',
  fillIn: 'Fill in',
  view: 'View',
  notCompleted: 'Not yet completed',
  due: 'Due',
  loadMore: 'Load more',
} as const;

export const FILL_COPY = {
  loadError: 'Could not load this survey.',
  answersTitle: 'Your answers',
  completedTitle: 'Completed',
  submit: 'Submit',
  submitting: 'Submitting…',
  submitted: 'Response submitted. Thank you!',
  submitFailed: 'Could not submit that response.',
  back: 'Back to My Surveys',
  alreadySubmitted: (completedAt: string | null) =>
    `You already submitted this survey${completedAt ? ` on ${new Date(completedAt).toLocaleDateString('en-GB')}` : ''}.`,
  fixErrors: 'Some answers still need attention — see the highlighted questions.',
} as const;

export const MY_STATUS_LABEL: Record<SurveyAssignmentStatus, string> = {
  PENDING: 'New',
  SEEN: 'Seen',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
};

export const MY_STATUS_TONE: Record<SurveyAssignmentStatus, Tone> = {
  PENDING: 'warning',
  SEEN: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  EXPIRED: 'neutral',
};

/** Bold title + dot: not yet done (web's "unread" row). */
export const isUnread = (status: SurveyAssignmentStatus): boolean => status === 'PENDING' || status === 'SEEN';

export const rowActionLabel = (status: SurveyAssignmentStatus): string => (status === 'COMPLETED' ? MY_SURVEYS_COPY.view : MY_SURVEYS_COPY.fillIn);

/** Only a brand-new assignment is marked seen, once, on opening it. */
export const shouldMarkSeen = (a: Pick<MySurveyAssignment, 'status'>): boolean => a.status === 'PENDING';

/* --- Filling in ---------------------------------------------------------- */

export type FillValues = Record<string, unknown>;

/** Every answerable field starts empty: '' or [] for a multiselect. */
export const fillDefaults = (schema: readonly SurveyField[]): FillValues => {
  const values: FillValues = {};
  for (const f of schema) {
    if (f.kind === 'section') continue;
    values[f.key] = f.kind === 'multiselect' ? [] : '';
  }
  return values;
};

export const requiredMessage = (f: Pick<SurveyField, 'label'>): string => `${f.label} is required`;

const isEmptyAnswer = (f: SurveyField, v: unknown): boolean => {
  if (f.kind === 'multiselect') return !Array.isArray(v) || v.length === 0;
  if (f.kind === 'boolean') return v !== true && v !== false;
  if (f.kind === 'rating') return typeof v !== 'number';
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
};

/** Web's renderer rules: only `required` is checked, per kind, with
 * "{Label} is required". Returns the errors keyed by field key. */
export const validateFill = (schema: readonly SurveyField[], values: FillValues): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const f of schema) {
    if (f.kind === 'section' || !f.required) continue;
    if (isEmptyAnswer(f, values[f.key])) errors[f.key] = requiredMessage(f);
  }
  return errors;
};

/** One answer per answerable field, in schema order — unanswered optional
 * fields go as their empty value, exactly as web sends them. */
export const buildAnswers = (schema: readonly SurveyField[], values: FillValues) =>
  schema.filter((f) => f.kind !== 'section').map((f) => ({ fieldKey: f.key, value: values[f.key] }));

/** A submitted answer as web's Completed panel prints it. */
export const formatSubmitted = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return value === null || value === undefined || value === '' ? '—' : String(value);
};

/* --- Tube map ------------------------------------------------------------ */

export const MY_TUBE_COPY = {
  search: 'Find a survey or stop',
  emptyTitle: 'Nothing to map yet',
  emptyBody: 'Surveys sent to you appear here as lines.',
  noMatch: 'Nothing on the map matches that search.',
  errorTitle: 'Could not load the tube map',
  errorBody: 'The workflow service did not answer. Try again in a moment.',
} as const;

export const MY_SURVEY_STAGES = [
  { key: 'survey', label: '1 · Survey', hint: 'What you were asked' },
  { key: 'opened', label: '2 · Opened', hint: 'Have you looked' },
  { key: 'state', label: '3 · State', hint: 'Where it stands' },
  { key: 'due', label: '4 · Due', hint: 'By when' },
  { key: 'tally', label: '5 · Tally', hint: 'How many' },
] as const;
export type MyStageKey = (typeof MY_SURVEY_STAGES)[number]['key'];

export const STATE_LABELS: Record<string, string> = {
  PENDING: 'Waiting for you',
  SEEN: 'Opened, not finished',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
};

export const EXPIRED_REASONS: Record<string, string> = {
  SUPERSEDED_BY_NEWER_RUN: 'Replaced by a newer one',
  RECIPIENT_REMOVED: 'You were removed from it',
};

export interface MyStop {
  id: string;
  stage: MyStageKey;
  label: string;
  sublabel: string | null;
  dashed: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const dayOf = (iso: string) => iso.slice(0, 10);

/** Web's `mySurveyJourney.stopsOf`, stop for stop. */
export const mySurveyStops = (s: MsSurveyWire, now: number = Date.now()): MyStop[] => {
  const l = s.latest;
  const opened = l.seenAt !== null || l.status !== 'PENDING';
  const expired = l.status === 'EXPIRED';
  const reason = expired && l.expiredReason ? l.expiredReason : null;
  const stops: MyStop[] = [
    { id: `survey:${s.surveyId}`, stage: 'survey', label: s.title, sublabel: `Asked ${plural(s.asked, 'time')}`, dashed: false },
    opened
      ? { id: 'opened:yes', stage: 'opened', label: 'Opened', sublabel: null, dashed: false }
      : { id: 'opened:no', stage: 'opened', label: 'Not opened yet', sublabel: null, dashed: true },
    {
      id: reason ? `state:EXPIRED:${reason}` : `state:${l.status}`,
      stage: 'state',
      label: STATE_LABELS[l.status] ?? l.status,
      sublabel: reason ? (EXPIRED_REASONS[reason] ?? reason) : null,
      dashed: l.status === 'PENDING' || expired,
    },
  ];
  if (l.status === 'COMPLETED') stops.push({ id: 'due:done', stage: 'due', label: 'Finished', sublabel: l.completedAt ? dayOf(l.completedAt) : null, dashed: false });
  else if (expired) stops.push({ id: 'due:closed', stage: 'due', label: 'Closed', sublabel: null, dashed: false });
  else if (l.dueAt === null) stops.push({ id: 'due:none', stage: 'due', label: 'No due date', sublabel: null, dashed: false });
  else if (Date.parse(l.dueAt) < now) stops.push({ id: 'due:overdue', stage: 'due', label: 'Overdue', sublabel: `Was due ${dayOf(l.dueAt)}`, dashed: true });
  else stops.push({ id: 'due:later', stage: 'due', label: 'Due later', sublabel: dayOf(l.dueAt), dashed: false });
  stops.push({ id: `tally:${s.surveyId}`, stage: 'tally', label: `${s.asked}× asked · ${s.completed} done`, sublabel: `Latest ${dayOf(l.createdAt)}`, dashed: s.completed === 0 });
  return stops;
};

export const filterMyLines = (surveys: readonly MsSurveyWire[], query: string, now?: number): MsSurveyWire[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...surveys];
  return surveys.filter((s) => mySurveyStops(s, now).some((st) => st.label.toLowerCase().includes(q) || (st.sublabel ?? '').toLowerCase().includes(q)));
};
