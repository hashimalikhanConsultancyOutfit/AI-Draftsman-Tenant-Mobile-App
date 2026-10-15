/**
 * Surveys — pure rules and copy, ported from the web app's
 * `features/Survey/**` (`*.data.ts`, the hooks' pure helpers and the
 * components' inline strings). No React and no RN imports, so every rule
 * here runs under plain Node in the module's tests.
 */
import type {
  SchedulePreset,
  SetSurveyScheduleRequest,
  SmSurveyWire,
  Survey,
  SurveyAssignmentStatus,
  SurveyAudienceRuleType,
  SurveyDraft,
  SurveyEvaluationMode,
  SurveyField,
  SurveyFieldKind,
  SurveySchedule,
  SurveyStatus,
} from './surveys.types';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export const SURVEYS_COPY = {
  title: 'Surveys',
  description: 'Build surveys, target an audience, send them, and review what comes back.',
  newSurvey: 'New survey',
  listView: 'Survey list',
  mapView: 'Tube map',
  emptyTitle: 'No surveys yet',
  emptyBody: 'Build your first survey to start collecting responses.',
  errorTitle: 'Could not load surveys',
  errorBody: 'The workflow service did not answer. Nothing has been lost — try again in a moment.',
  loadMore: 'Load more',
  view: 'View',
} as const;

export const STATUS_LABEL: Record<SurveyStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
};

export const STATUS_TONE: Record<SurveyStatus, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  PAUSED: 'warning',
  ARCHIVED: 'danger',
};

/** The list's status filter — `''` is "All statuses". */
export const STATUS_FILTERS: Array<{ value: '' | SurveyStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const STATUS_OPTIONS = (['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const).map((value) => ({ value, label: STATUS_LABEL[value] }));

export const EVALUATION_LABEL: Record<SurveyEvaluationMode, string> = { AI: 'AI', MANUAL: 'Manual' };

/** Web's two options ("Manual — a manager reviews and rates each response",
 * "AI — scored automatically"), split into a short label for the field and
 * the rest as the option's description, so neither gets cut off on a phone. */
export const EVALUATION_MODE_OPTIONS: Array<{ value: SurveyEvaluationMode; label: string; description: string; hint?: string }> = [
  { value: 'MANUAL', label: 'Manual', description: 'A manager reviews and rates each response' },
  { value: 'AI', label: 'AI', description: 'Scored automatically', hint: 'Each response is scored against the knowledge base below as soon as it is submitted.' },
];

/** The line under the field: what the chosen mode means, plus web's AI hint. */
export const evaluationHint = (mode: SurveyEvaluationMode): string | undefined => {
  const o = EVALUATION_MODE_OPTIONS.find((x) => x.value === mode);
  return o ? [`${o.description}.`, o.hint].filter(Boolean).join(' ') : undefined;
};

/** Rows already held, plus a newly loaded page — a row that shifted pages
 * between the two reads is kept once, in its first position. */
export const appendUnique = <T extends { id: string }>(held: readonly T[], next: readonly T[]): T[] => {
  const seen = new Set(held.map((r) => r.id));
  return [...held, ...next.filter((r) => !seen.has(r.id))];
};

/* -------------------------------------------------------------------------- */
/* Details (wizard step 1 and the Details tab)                                */
/* -------------------------------------------------------------------------- */

export const TITLE_MAX = 200;

export const DETAILS_COPY = {
  wizardTitle: 'New survey',
  wizardDescription: 'Set the details, then who receives it and when, then build the form itself — all in one flow.',
  titleLabel: 'Title',
  descriptionLabel: 'Description',
  kbLabel: 'Knowledge base for AI scoring',
  kbNone: 'None selected',
  kbHint: 'An answer is judged against what this base says — without one, AI scoring refuses every response.',
  statusLabel: 'Status',
  evaluationLabel: 'Evaluation mode',
  titleRequiredContinue: 'Give the survey a title before continuing.',
  titleRequiredSave: 'Give the survey a title before saving.',
  created: (title: string) => `Survey “${title}” created.`,
  createFailed: 'Could not create that survey.',
  updated: 'Survey updated.',
  updateFailed: 'Could not update that survey.',
  saveChanges: 'Save changes',
  cancel: 'Cancel',
  finishLater: 'Finish later',
  nextTargeting: 'Next: Audience & Schedule',
  nextForm: 'Next: Survey Form',
  back: 'Back',
  finish: 'Finish',
} as const;

export const WIZARD_STEPS = ['details', 'targeting', 'fields'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
export const WIZARD_STEP_LABEL: Record<WizardStep, string> = {
  details: 'Details',
  targeting: 'Audience & Schedule',
  fields: 'Survey Form',
};

export interface SurveyDetailsValues {
  title: string;
  description: string;
  status: SurveyStatus;
  evaluationMode: SurveyEvaluationMode;
  evaluationKnowledgeBaseId: string;
}

export const detailsFromSurvey = (s: Survey): SurveyDetailsValues => ({
  title: s.title,
  description: s.description ?? '',
  status: s.status,
  evaluationMode: s.evaluationMode,
  evaluationKnowledgeBaseId: s.evaluationKnowledgeBaseId ?? '',
});

/** Web's `useSurveyDetails` patch — ONLY the fields that changed, trimmed.
 * Empty object = nothing to save (the button stays disabled). */
export const surveyDetailsPatch = (s: Survey, v: SurveyDetailsValues): Partial<SurveyDetailsValues> => {
  const patch: Partial<SurveyDetailsValues> = {};
  if (v.title.trim() !== s.title) patch.title = v.title.trim();
  if (v.description.trim() !== (s.description ?? '')) patch.description = v.description.trim();
  if (v.status !== s.status) patch.status = v.status;
  if (v.evaluationMode !== s.evaluationMode) patch.evaluationMode = v.evaluationMode;
  if (v.evaluationKnowledgeBaseId !== (s.evaluationKnowledgeBaseId ?? '')) patch.evaluationKnowledgeBaseId = v.evaluationKnowledgeBaseId;
  return patch;
};

/** The create body — empty optional fields are dropped, never sent blank. */
export const createSurveyBody = (v: Pick<SurveyDetailsValues, 'title' | 'description' | 'evaluationMode' | 'evaluationKnowledgeBaseId'>) => ({
  title: v.title.trim(),
  ...(v.description.trim() ? { description: v.description.trim() } : {}),
  ...(v.evaluationKnowledgeBaseId ? { evaluationKnowledgeBaseId: v.evaluationKnowledgeBaseId } : {}),
  evaluationMode: v.evaluationMode,
  schema: [] as SurveyField[],
});

/* -------------------------------------------------------------------------- */
/* Detail page                                                                */
/* -------------------------------------------------------------------------- */

export const DETAIL_TABS = ['overview', 'details', 'form', 'targeting', 'responses'] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];
export const DETAIL_TAB_LABEL: Record<DetailTab, string> = {
  overview: 'Overview',
  details: 'Details',
  form: 'Survey Form',
  targeting: 'Audience & Schedule',
  responses: 'Responses',
};

export const DETAIL_COPY = {
  loadErrorTitle: 'Could not load this survey',
  loadErrorBody: 'It may have been removed, or the workflow service did not answer. Try again in a moment.',
} as const;

/* -------------------------------------------------------------------------- */
/* Survey Form editor                                                         */
/* -------------------------------------------------------------------------- */

export const FIELD_KIND_LABEL: Record<SurveyFieldKind, string> = {
  text: 'Text',
  textarea: 'Long text',
  email: 'Email',
  phone: 'Phone',
  number: 'Number',
  date: 'Date',
  select: 'Select (dropdown)',
  multiselect: 'Multi select',
  url: 'URL',
  rating: 'Rating (1–5)',
  boolean: 'Yes / No',
  section: 'Section heading',
};

/** The kind picker on a field — every kind but the section marker. */
export const REAL_FIELD_KIND_OPTIONS = (Object.keys(FIELD_KIND_LABEL) as SurveyFieldKind[])
  .filter((k) => k !== 'section')
  .map((value) => ({ value, label: FIELD_KIND_LABEL[value] }));

export const OPTION_BEARING_KINDS: readonly SurveyFieldKind[] = ['select', 'multiselect'];
export const RATING_SCALE = ['1', '2', '3', '4', '5'];
export const MIN_OPTIONS = 2;

export const FORM_COPY = {
  title: 'Survey Form',
  addSection: 'Add section',
  addField: 'Add field',
  preview: 'Preview',
  generate: 'Generate with AI',
  saved: 'Survey form saved.',
  saveFailed: 'Could not save that form.',
  sectionTitle: 'Section title',
  sectionHelp: 'Section description (optional)',
  fieldLabel: 'Question',
  fieldHelp: 'Help text (optional)',
  fieldKind: 'Answer type',
  required: 'Required',
  addOption: 'Add option',
  optionsCounter: (n: number) => `Options (${n}/${MIN_OPTIONS} minimum)`,
  optionPlaceholder: (i: number) => `Option ${i}`,
  ratingNote: 'Respondents pick 1 to 5.',
  emptySection: 'No fields in this section yet.',
  removeSectionTitle: 'Remove this section?',
  removeSectionConfirm: 'Remove section',
  removeSectionBody: (label: string, count: number) =>
    `“${label}” and its ${count} field${count === 1 ? '' : 's'} will be removed. This cannot be undone.`,
  overwriteTitle: 'Replace the current fields?',
  overwriteConfirm: 'Use this draft anyway',
  overwriteBody: 'Using this draft replaces the fields already on this form. This cannot be undone.',
  draftApplied: (title: string) => `Draft "${title}" applied — review its fields below.`,
  previewTitle: 'Preview',
  previewEmpty: 'Nothing to preview yet — add a field first.',
} as const;

/** One editable row — a `SurveyField` plus a stable local `uid`, with
 * `help`/`options` always present so inputs never flip controlled-ness. */
export interface BuilderField {
  uid: string;
  key: string;
  kind: SurveyFieldKind;
  label: string;
  help: string;
  required: boolean;
  options: string[];
}

export interface BuilderSection {
  sectionField: BuilderField;
  members: BuilderField[];
}

let uidCounter = 0;
export const nextUid = (): string => `field-${(uidCounter += 1)}`;

/** Web's `slugifyKey` — lowercase, underscores, de-duplicated with `_2`. */
export const slugifyKey = (label: string, existing: Set<string>): string => {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
};

export const newBuilderField = (existingKeys: Set<string>): BuilderField => ({
  uid: nextUid(),
  key: slugifyKey('untitled question', existingKeys),
  kind: 'text',
  label: '',
  help: '',
  required: true,
  options: [],
});

export const humanizeSectionKey = (key: string): string => {
  const words = key.trim().split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return 'Untitled section';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export const defaultSectionField = (index: number, existingKeys: Set<string>): BuilderField => {
  const label = `Section ${index}`;
  return { uid: nextUid(), key: slugifyKey(label, existingKeys), kind: 'section', label, help: '', required: false, options: [] };
};

/** Fields before the first section marker belong to no section — `seedFields`
 * guarantees there are none by putting a marker first. */
export const groupFieldsBySections = (fields: readonly BuilderField[]): BuilderSection[] => {
  const sections: BuilderSection[] = [];
  let current: BuilderSection | null = null;
  for (const field of fields) {
    if (field.kind === 'section') {
      current = { sectionField: field, members: [] };
      sections.push(current);
    } else if (current) {
      current.members.push(field);
    }
  }
  return sections;
};

export const currentVersionSchema = (survey: Pick<Survey, 'versions' | 'currentVersionId'>): SurveyField[] => {
  const v = survey.versions?.find((x) => x.id === survey.currentVersionId) ?? survey.versions?.[0];
  return v?.schema ?? [];
};

export const fromSurveyFieldSchema = (schema: readonly SurveyField[]): BuilderField[] =>
  schema.map((f) => ({ uid: nextUid(), key: f.key, kind: f.kind, label: f.label, help: f.help ?? '', required: f.required, options: f.options ?? [] }));

/** Empty schema → one "Section 1"; a schema not starting with a section
 * gets one in front so every field belongs to a section. */
export const seedFields = (schema: readonly SurveyField[]): BuilderField[] => {
  const hydrated = fromSurveyFieldSchema(schema);
  if (hydrated.length === 0) return [defaultSectionField(1, new Set())];
  if (hydrated[0]?.kind !== 'section') return [defaultSectionField(1, new Set(hydrated.map((f) => f.key))), ...hydrated];
  return hydrated;
};

export const toSurveyFieldSchema = (fields: readonly BuilderField[]): SurveyField[] =>
  fields.map((f) => ({
    key: f.key,
    kind: f.kind,
    label: f.label.trim(),
    ...(f.help.trim() ? { help: f.help.trim() } : {}),
    required: f.required,
    ...(OPTION_BEARING_KINDS.includes(f.kind) ? { options: f.options.map((o) => o.trim()).filter(Boolean) } : {}),
    ...(f.kind === 'rating' ? { options: RATING_SCALE } : {}),
  }));

/** Why Save is disabled — the first problem only, exactly web's order. */
export const fieldsBlockedReason = (fields: readonly BuilderField[]): string | null => {
  if (fields.filter((f) => f.kind !== 'section').length === 0) return 'Add at least one field.';
  for (const f of fields) {
    if (!f.label.trim()) return f.kind === 'section' ? 'Every section needs a title.' : 'Every field needs a label.';
    if (OPTION_BEARING_KINDS.includes(f.kind) && f.options.filter((o) => o.trim()).length < MIN_OPTIONS) {
      return `“${f.label}” needs at least ${MIN_OPTIONS} options.`;
    }
  }
  return null;
};

/* --- Editor operations: each takes the flat list and returns a new one. --- */

export const addSection = (fields: readonly BuilderField[]): BuilderField[] => {
  const count = fields.filter((f) => f.kind === 'section').length;
  return [...fields, defaultSectionField(count + 1, new Set(fields.map((f) => f.key)))];
};

/** Swaps two adjacent section BLOCKS (marker + members) wholesale. */
export const moveSection = (fields: readonly BuilderField[], sectionUid: string, direction: 'up' | 'down'): BuilderField[] => {
  const groups = groupFieldsBySections(fields);
  const i = groups.findIndex((g) => g.sectionField.uid === sectionUid);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= groups.length) return [...fields];
  const blocks = groups.map((g) => [g.sectionField, ...g.members]);
  const a = blocks[i]!;
  blocks[i] = blocks[j]!;
  blocks[j] = a;
  return blocks.flat();
};

export const removeSection = (fields: readonly BuilderField[], sectionUid: string): BuilderField[] => {
  const group = groupFieldsBySections(fields).find((g) => g.sectionField.uid === sectionUid);
  if (!group) return [...fields];
  const drop = new Set([group.sectionField.uid, ...group.members.map((m) => m.uid)]);
  return fields.filter((f) => !drop.has(f.uid));
};

/** Appends a new field at the END of this section's members — never past
 * them into the following section. */
export const addFieldToSection = (fields: readonly BuilderField[], sectionUid: string): BuilderField[] => {
  const at = fields.findIndex((f) => f.uid === sectionUid);
  if (at < 0) return [...fields];
  let insertAt = at + 1;
  while (insertAt < fields.length && fields[insertAt]?.kind !== 'section') insertAt += 1;
  const next = [...fields];
  next.splice(insertAt, 0, newBuilderField(new Set(fields.map((f) => f.key))));
  return next;
};

export const removeField = (fields: readonly BuilderField[], uid: string): BuilderField[] => fields.filter((f) => f.uid !== uid);

/** Adjacent swap — the UI only offers it within a field's own section, so
 * the neighbour is always a fellow member. Refuses to swap with a marker
 * anyway, so a bad call cannot move a field across sections. */
export const moveField = (fields: readonly BuilderField[], uid: string, direction: 'up' | 'down'): BuilderField[] => {
  const i = fields.findIndex((f) => f.uid === uid);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= fields.length || fields[j]?.kind === 'section') return [...fields];
  const next = [...fields];
  next[i] = fields[j]!;
  next[j] = fields[i]!;
  return next;
};

export const updateField = (fields: readonly BuilderField[], uid: string, patch: Partial<BuilderField>): BuilderField[] =>
  fields.map((f) => (f.uid === uid ? { ...f, ...patch } : f));

/** The key is derived ONCE, from the first real label, and never moves
 * after — so answers already keyed to it stay addressable. */
export const changeFieldLabel = (fields: readonly BuilderField[], uid: string, label: string): BuilderField[] =>
  fields.map((f) => {
    if (f.uid !== uid) return f;
    const stillPlaceholder = !f.label.trim();
    return {
      ...f,
      label,
      key: stillPlaceholder ? slugifyKey(label || 'untitled question', new Set(fields.filter((o) => o.uid !== uid).map((o) => o.key))) : f.key,
    };
  });

export const changeFieldKind = (fields: readonly BuilderField[], uid: string, kind: SurveyFieldKind): BuilderField[] =>
  updateField(fields, uid, { kind, ...(kind === 'rating' ? { options: RATING_SCALE } : {}) });

export const addOption = (fields: readonly BuilderField[], uid: string): BuilderField[] =>
  fields.map((f) => (f.uid === uid ? { ...f, options: [...f.options, ''] } : f));

export const setOption = (fields: readonly BuilderField[], uid: string, index: number, value: string): BuilderField[] =>
  fields.map((f) => (f.uid === uid ? { ...f, options: f.options.map((o, i) => (i === index ? value : o)) } : f));

export const removeOption = (fields: readonly BuilderField[], uid: string, index: number): BuilderField[] =>
  fields.map((f) => (f.uid === uid ? { ...f, options: f.options.filter((_, i) => i !== index) } : f));

/** Has the manager built anything a draft would overwrite? */
export const hasRealFields = (fields: readonly BuilderField[]): boolean => fields.some((f) => f.kind !== 'section');

/** An AI draft, as builder rows. Help is dropped, option-bearing kinds get
 * two blank options to fill in, and a section with no title is named from
 * its key. A draft without its own section gets "Section 1" in front. */
export const draftToBuilderFields = (draft: SurveyDraft): BuilderField[] => {
  const rows: BuilderField[] = draft.fields.map((f) => ({
    uid: nextUid(),
    key: f.key,
    kind: f.kind,
    label: f.kind === 'section' && !f.label.trim() ? humanizeSectionKey(f.key) : f.label,
    help: '',
    required: f.required,
    options: OPTION_BEARING_KINDS.includes(f.kind) ? ['', ''] : [],
  }));
  return rows.some((f) => f.kind === 'section') ? rows : [defaultSectionField(1, new Set()), ...rows];
};

/* -------------------------------------------------------------------------- */
/* Audience & send                                                            */
/* -------------------------------------------------------------------------- */

export type EditableRuleType = Exclude<SurveyAudienceRuleType, 'SEGMENT_TAG'>;

export const AUDIENCE_RULE_LABEL: Record<EditableRuleType, string> = {
  SPECIFIC_TENANT_USERS: 'Specific tenant users',
  ALL_TENANT_USERS: 'All tenant users',
  SPECIFIC_CUSTOMERS: 'Specific customers',
  ALL_CUSTOMERS: 'All customers',
};

export const AUDIENCE_RULE_OPTIONS = (Object.keys(AUDIENCE_RULE_LABEL) as EditableRuleType[]).map((value) => ({ value, label: AUDIENCE_RULE_LABEL[value] }));

export const DEFAULT_RULE_TYPE: EditableRuleType = 'ALL_TENANT_USERS';

export const AUDIENCE_COPY = {
  title: 'Audience',
  ruleLabel: 'Who should get this survey',
  save: 'Save audience',
  saved: 'Audience saved.',
  saveFailed: 'Could not save that audience rule.',
  nobodySelected: 'Nobody is selected yet — pick at least one above.',
  selected: (n: number) => `${n} selected`,
  selectAll: 'Select all',
  clear: 'Clear',
  searchPlaceholder: 'Search by name',
  noMembers: 'No workspace members found.',
  noCustomers: 'No customers found.',
  sendTitle: 'Send',
  sendBody: 'Send this survey right now, on top of any schedule — the audience is resolved fresh at send time.',
  sendNow: 'Send now',
  sending: 'Sending…',
  noAudience: 'Save an audience above before sending.',
  archived: 'An archived survey cannot be sent.',
  confirmTitle: 'Send this survey now?',
  confirmBody: "The audience is resolved fresh at send time and assignments appear in each recipient's own portal immediately. This cannot be undone.",
  calculating: 'Calculating…',
  sendFailed: 'Could not send that survey.',
} as const;

export const SKIP_REASON_LABEL: Record<string, string> = {
  NOT_FOUND: 'No longer exists',
  INACTIVE_USER: 'Inactive user',
  NO_PORTAL_ACCESS: 'No portal access',
  RECIPIENT_REMOVED: 'Recipient removed',
};

export const idsFromCriteria = (criteria: Record<string, unknown> | null | undefined, key: 'userIds' | 'customerIds'): string[] => {
  const v = criteria?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
};

/** A saved SEGMENT_TAG rule (web cannot edit one either) opens on the default. */
export const editableRuleType = (t: SurveyAudienceRuleType | null | undefined): EditableRuleType =>
  t && t !== 'SEGMENT_TAG' ? t : DEFAULT_RULE_TYPE;

export const needsPicker = (t: EditableRuleType): boolean => t === 'SPECIFIC_TENANT_USERS' || t === 'SPECIFIC_CUSTOMERS';

export const audienceCriteria = (t: EditableRuleType, userIds: string[], customerIds: string[]): Record<string, unknown> | undefined => {
  if (t === 'SPECIFIC_TENANT_USERS') return { userIds };
  if (t === 'SPECIFIC_CUSTOMERS') return { customerIds };
  return undefined;
};

/** Null when Send now is allowed, otherwise the line shown under it. */
export const sendBlockedReason = (s: Pick<Survey, 'audienceRule' | 'status'>): string | null => {
  if (!s.audienceRule) return AUDIENCE_COPY.noAudience;
  if (s.status === 'ARCHIVED') return AUDIENCE_COPY.archived;
  return null;
};

export const sendToast = (assigned: number, skipped: number): string =>
  `Sent to ${assigned} recipient${assigned === 1 ? '' : 's'}${skipped > 0 ? `, ${skipped} skipped` : ''}.`;

export const sendBanner = (assigned: number, skipped: number): string => `Assigned to ${assigned}${skipped > 0 ? `, skipped ${skipped}` : ''}.`;

export const activeScheduleWarning = (mode: 'ONE_TIME' | 'RECURRING'): string =>
  `This survey also has an active ${mode === 'ONE_TIME' ? 'one-time' : 'recurring'} schedule — sending now is in addition to that, not instead of it.`;

/** Multi-word, case-insensitive name filter for the picker. */
export const filterPickerOptions = <T extends { label: string }>(options: readonly T[], query: string): T[] => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...options];
  return options.filter((o) => words.every((w) => o.label.toLowerCase().includes(w)));
};

/* -------------------------------------------------------------------------- */
/* Schedule                                                                   */
/* -------------------------------------------------------------------------- */

export const SCHEDULE_COPY = {
  title: 'Scheduled delivery',
  none: 'No schedule set. Add one to deliver this survey automatically, once or on a repeating cadence.',
  add: 'Add a schedule',
  edit: 'Edit schedule',
  oneTime: 'One-time',
  recurring: 'Recurring',
  active: 'Active',
  inactive: 'Completed / disabled',
  timezone: 'Timezone',
  cron: 'Cron',
  nextRun: 'Next run',
  ends: 'Ends',
  /* Shown only when the schedule has an occurrence limit — as web. */
  fired: (n: number, limit: number) => `Fired ${n} of ${limit} times.`,
  saved: 'Schedule saved.',
  saveFailed: 'Could not save that schedule.',
  pastDate: 'Pick a date and time in the future.',
  loadFailed: 'Could not load this survey’s schedule.',
  create: {
    title: 'Schedule this survey',
    description: 'Sets when the survey is delivered automatically, once or on a repeating cadence — only one schedule can be active at a time.',
    submit: 'Save schedule',
  },
  editForm: {
    title: 'Edit schedule',
    description: 'Saving replaces the current schedule outright.',
    submit: 'Save changes',
  },
  runsTitle: 'Runs',
  runsEmptyTitle: 'No runs yet',
  runsEmptyBody: 'Nothing has fired for this survey yet.',
  runsError: 'Could not load this survey’s runs.',
  timezoneHint: 'The IANA timezone this schedule’s wall-clock time is read in.',
  dateHint: 'Must be a future date and time.',
  cronHint: 'Raw cron, e.g. "0 */2 * * *". Floor-guarded to a 15-minute minimum interval on the server.',
} as const;

export const SCHEDULE_MODE_OPTIONS = [
  { value: 'ONE_TIME', label: 'One-time — fires once at a date and time you pick' },
  { value: 'RECURRING', label: 'Recurring — fires on a repeating cadence' },
];

export const PRESET_OPTIONS: Array<{ value: SchedulePreset; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'CUSTOM', label: 'Custom cron' },
];

export const WEEKDAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, i) => ({ value: String(i), label }));

export const ordinal = (day: number): string => {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`;
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${day}${suffixes[day % 10] ?? 'th'}`;
};

export const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }));

export const END_CONDITION_OPTIONS = [
  { value: 'NONE', label: 'No end' },
  { value: 'DATE', label: 'End by date' },
  { value: 'COUNT', label: 'Stop after N occurrences' },
];

/** Web's list, device zone first. */
export const COMMON_TIMEZONES = [
  'UTC', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Warsaw', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Perth', 'Australia/Sydney',
  'Pacific/Auckland', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
];

export const guessTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const scheduleTimezoneOptions = (device: string = guessTimezone()) =>
  [device, ...COMMON_TIMEZONES.filter((z) => z !== device)].map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));

/** The wall-clock parts of an instant in a zone. `h23` so midnight is 00. */
const zonedParts = (ms: number, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value] as const),
  ) as Record<string, string>;
  /* Some engines still print 24 for midnight even with h23. */
  const hour = Number(parts.hour) % 24;
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour, minute: Number(parts.minute), second: Number(parts.second) };
};

/** The zone's UTC offset at an instant, in minutes. Derived from the zoned
 * wall clock rather than `timeZoneName: 'shortOffset'` (web's approach),
 * which Hermes' Intl does not reliably support. */
export const timeZoneOffsetMinutes = (utcMs: number, timeZone: string): number => {
  const p = zonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
};

/** `YYYY-MM-DD` + `HH:MM` read in `timeZone` → a UTC ISO instant. Two passes
 * so a DST edge resolves to the offset in force AT that wall-clock time. */
export const zonedDateTimeToUtcIso = (dateStr: string, timeStr: string, timeZone: string): string => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const naive = Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0);
  const first = timeZoneOffsetMinutes(naive, timeZone);
  const second = timeZoneOffsetMinutes(naive - first * 60000, timeZone);
  return new Date(naive - second * 60000).toISOString();
};

export const utcIsoToZonedParts = (iso: string, timeZone: string): { date: string; time: string } | null => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const p = zonedParts(at.getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
};

export const isValidIsoDate = (value: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return date.getUTCFullYear() === Number(m[1]) && date.getUTCMonth() + 1 === Number(m[2]) && date.getUTCDate() === Number(m[3]);
};

export const isValidHhmm = (value: string): boolean => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  return Boolean(m && Number(m[1]) <= 23 && Number(m[2]) <= 59);
};

/** The schedule form's values — strings, as typed or picked. */
export interface ScheduleFormValues {
  mode: 'ONE_TIME' | 'RECURRING';
  timezone: string;
  startDate: string;
  startTime: string;
  preset: SchedulePreset;
  hour: string;
  minute: string;
  dayOfWeek: string;
  dayOfMonth: string;
  customCron: string;
  endCondition: 'NONE' | 'DATE' | 'COUNT';
  endAt: string;
  occurrenceLimit: string;
}

export const scheduleFormDefaults = (timezone: string = guessTimezone()): ScheduleFormValues => ({
  mode: 'ONE_TIME',
  timezone,
  startDate: '',
  startTime: '09:00',
  preset: 'DAILY',
  hour: '9',
  minute: '0',
  dayOfWeek: '1',
  dayOfMonth: '1',
  customCron: '',
  endCondition: 'NONE',
  endAt: '',
  occurrenceLimit: '',
});

/** Editing seeds a recurring schedule as CUSTOM with its cron — the server
 * keeps the cron, not the preset it came from. */
export const scheduleEditSeed = (s: SurveySchedule): ScheduleFormValues => {
  const seed = scheduleFormDefaults(s.timezone);
  seed.mode = s.mode;
  if (s.mode === 'ONE_TIME') {
    const zoned = s.startAt ? utcIsoToZonedParts(s.startAt, s.timezone) : null;
    seed.startDate = zoned?.date ?? '';
    seed.startTime = zoned?.time ?? '09:00';
  } else {
    seed.preset = 'CUSTOM';
    seed.customCron = s.cron ?? '';
  }
  if (s.endAt) {
    seed.endCondition = 'DATE';
    seed.endAt = utcIsoToZonedParts(s.endAt, s.timezone)?.date ?? '';
  } else if (s.occurrenceLimit) {
    seed.endCondition = 'COUNT';
    seed.occurrenceLimit = String(s.occurrenceLimit);
  }
  return seed;
};

export const buildScheduleRequest = (surveyId: string, v: ScheduleFormValues): SetSurveyScheduleRequest => {
  const timezone = v.timezone || guessTimezone();
  if (v.mode === 'ONE_TIME') {
    return { id: surveyId, mode: 'ONE_TIME', timezone, startAt: zonedDateTimeToUtcIso(v.startDate, v.startTime || '09:00', timezone) };
  }
  const preset: SchedulePreset = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'].includes(v.preset) ? v.preset : 'DAILY';
  const req: SetSurveyScheduleRequest = { id: surveyId, mode: 'RECURRING', timezone, preset };
  if (preset === 'CUSTOM') {
    req.customCron = v.customCron.trim();
  } else {
    req.hour = Number(v.hour || 9);
    req.minute = Number(v.minute || 0);
    if (preset === 'WEEKLY') req.dayOfWeek = Number(v.dayOfWeek || 1);
    if (preset === 'MONTHLY') req.dayOfMonth = Number(v.dayOfMonth || 1);
  }
  if (v.endCondition === 'DATE' && v.endAt) req.endAt = zonedDateTimeToUtcIso(v.endAt, '23:59', timezone);
  else if (v.endCondition === 'COUNT' && v.occurrenceLimit) req.occurrenceLimit = Number(v.occurrenceLimit);
  return req;
};

/** A one-time schedule must be in the future — checked before any request,
 * exactly as web does. */
export const isPastOneTime = (req: SetSurveyScheduleRequest, now: number = Date.now()): boolean =>
  req.mode === 'ONE_TIME' && Boolean(req.startAt) && new Date(req.startAt as string).getTime() <= now;

/** `12 Oct 2026` — the run table's Due and the schedule's dates. */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** `12 Oct 2026, 09:00` */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${formatDate(iso)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export const RUN_STATUS_LABEL: Record<'COMPLETED' | 'FAILED', string> = { COMPLETED: 'Completed', FAILED: 'Failed' };
export const RUN_STATUS_TONE: Record<'COMPLETED' | 'FAILED', Tone> = { COMPLETED: 'success', FAILED: 'danger' };

/* -------------------------------------------------------------------------- */
/* Overview (dashboard)                                                       */
/* -------------------------------------------------------------------------- */

export const DASHBOARD_COPY = {
  totalAssigned: 'Total assigned',
  completionRate: 'Completion rate',
  responses: 'Responses',
  evaluated: 'Evaluated',
  averageScore: 'Average score',
  reviewed: 'Reviewed',
  byStatus: 'By status',
  recentRuns: (last: string | null) => (last ? `Recent runs — last ${last}` : 'Recent runs'),
  error: 'Could not load this survey\'s dashboard.',
} as const;

export const ASSIGNMENT_STATUS_ORDER: readonly SurveyAssignmentStatus[] = ['PENDING', 'SEEN', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED'];
export const ASSIGNMENT_STATUS_LABEL: Record<SurveyAssignmentStatus, string> = {
  PENDING: 'Pending',
  SEEN: 'Seen',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
};
export const ASSIGNMENT_STATUS_TONE: Record<SurveyAssignmentStatus, Tone> = {
  PENDING: 'neutral',
  SEEN: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  EXPIRED: 'danger',
};

export const formatScore = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${Math.round(v)}`);
export const formatRate = (v: number): string => `${Math.round((Number.isFinite(v) ? v : 0) * 100)}%`;

/** The stat tiles, in web's order — the last two depend on how responses
 * are judged. */
export const dashboardStats = (
  d: { totalAssigned: number; completionRate: number; responseCount: number; evaluatedCount: number; averageScore: number | null; reviewedCount: number },
  mode: SurveyEvaluationMode,
): Array<{ label: string; value: string }> => [
  { label: DASHBOARD_COPY.totalAssigned, value: String(d.totalAssigned) },
  { label: DASHBOARD_COPY.completionRate, value: formatRate(d.completionRate) },
  { label: DASHBOARD_COPY.responses, value: String(d.responseCount) },
  ...(mode === 'AI'
    ? [
        { label: DASHBOARD_COPY.evaluated, value: String(d.evaluatedCount) },
        { label: DASHBOARD_COPY.averageScore, value: formatScore(d.averageScore) },
      ]
    : [{ label: DASHBOARD_COPY.reviewed, value: String(d.reviewedCount) }]),
];

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

export const RESPONSES_COPY = {
  title: 'Responses',
  emptyTitle: 'No responses yet',
  emptyBody: 'Nothing has been submitted against this survey.',
  errorTitle: 'Could not load responses',
  errorBody: 'The workflow service did not answer. Try again in a moment.',
  review: 'Review',
  view: 'View',
  sheetTitle: 'Response',
  manualReview: 'Manual review',
  reviewedLabel: 'Reviewed',
  pending: 'Pending',
  ratingLabel: 'Rating',
  noRating: 'No rating',
  notesLabel: 'Notes',
  saveReview: 'Save review',
  reviewSaved: 'Review saved.',
  reviewFailed: 'Could not save that review.',
  aiEvaluation: 'AI evaluation',
  evaluating: 'Evaluating…',
  pendingEvaluation: 'Evaluating… this finishes automatically, usually within moments of submission.',
  failedEvaluation: 'Evaluation failed. This does not block the response — nothing else needs to happen here.',
  evaluationError: "Could not load this response's evaluation.",
  answers: (n: number) => `${n} answer${n === 1 ? '' : 's'}`,
  score: (s: number | null) => `Score: ${s ?? '—'}`,
  close: 'Close',
} as const;

export const RATING_OPTIONS = [{ value: '', label: 'No rating' }, ...RATING_SCALE.map((r) => ({ value: r, label: `${r}/5` }))];

export const SENTIMENT_TONE: Record<string, Tone> = { positive: 'success', negative: 'danger', neutral: 'neutral', mixed: 'warning' };
export const sentimentTone = (s: string | null | undefined): Tone => (s ? (SENTIMENT_TONE[s.toLowerCase()] ?? 'neutral') : 'neutral');

/** How long to wait between evaluation reads; 0 once it has settled. */
export const EVALUATION_POLL_MS = 4000;
export const evaluationPollInterval = (status: string | null | undefined): number => (status === 'DONE' || status === 'FAILED' ? 0 : EVALUATION_POLL_MS);

/** The label a respondent saw, from the version THIS response answered. */
export const answerLabel = (schema: readonly SurveyField[] | undefined, key: string): string => schema?.find((f) => f.key === key)?.label ?? key;

/** Arrays joined, booleans as the Yes/No the respondent picked. */
export const formatAnswerValue = (schema: readonly SurveyField[] | undefined, key: string, value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  const kind = schema?.find((f) => f.key === key)?.kind;
  if (kind === 'boolean' && typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

/** The review body — rating and notes only when set. */
export const reviewBody = (reviewed: boolean, rating: string, notes: string) => ({
  reviewed,
  ...(rating ? { manualRating: Number(rating) } : {}),
  ...(notes.trim() ? { notes: notes.trim() } : {}),
});

/* -------------------------------------------------------------------------- */
/* Generate with AI                                                           */
/* -------------------------------------------------------------------------- */

export const DRAFT_CHAT_NAMESPACE = '/survey-draft-chat';

export const AI_COPY = {
  title: 'Generate with AI',
  emptyTitle: 'Describe your survey',
  emptyBody: "Who it's for, what you want to learn — a draft comes back below for you to review before anything is saved.",
  placeholder: 'Describe the survey you want…',
  drafting: 'Drafting…',
  restoring: 'Loading previous conversation…',
  errorReply: 'Something went wrong getting a reply. Try sending that again.',
  useDraft: 'Use this draft',
  preview: 'Preview',
  more: (n: number) => `+${n} more`,
  attach: 'Attach a file',
  uploadFailed: 'Could not upload that file.',
  uploading: 'Uploading…',
  you: 'You',
  assistant: 'Assistant',
} as const;

/** How many of a draft's fields its card lists before "+N more". */
export const DRAFT_CARD_FIELD_LIMIT = 6;

export interface DrawerAttachment {
  id: string;
  name: string;
  status: 'uploading' | 'ready' | 'error';
  blobUrl?: string;
}

export interface DrawerMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: DrawerAttachment[];
  draft?: SurveyDraft;
  isError?: boolean;
}

/** A turn's text on the wire — an attachment-only turn says what it carried. */
export const toApiText = (m: Pick<DrawerMessage, 'text' | 'attachments'>): string => {
  const trimmed = m.text.trim();
  if (trimmed) return trimmed;
  const names = m.attachments?.map((a) => a.name) ?? [];
  return names.length > 0 ? `Attached: ${names.join(', ')}` : trimmed;
};

export const toApiMessage = (m: DrawerMessage) => {
  const ready = (m.attachments ?? []).filter((a) => a.status !== 'error' && a.status !== 'uploading').map((a) => ({ filename: a.name, ...(a.blobUrl ? { blobUrl: a.blobUrl } : {}) }));
  return { role: m.role, text: toApiText(m), ...(ready.length > 0 ? { attachments: ready } : {}) };
};

let messageCounter = 0;
export const nextMessageId = (): string => `draft-msg-${(messageCounter += 1)}`;

export const historyToDrawerMessages = (
  rows: ReadonlyArray<{ role: 'USER' | 'ASSISTANT'; text: string; attachments: Array<{ filename: string; blobUrl?: string }> | null; status: string | null; schema: SurveyDraft | null }>,
): DrawerMessage[] =>
  rows.map((row) => {
    const role = row.role === 'USER' ? 'user' : 'assistant';
    const attachments = row.attachments?.length
      ? row.attachments.map((a, i) => ({ id: `${nextMessageId()}-a${i}`, name: a.filename, status: 'ready' as const, ...(a.blobUrl ? { blobUrl: a.blobUrl } : {}) }))
      : undefined;
    return {
      id: nextMessageId(),
      role,
      text: row.text,
      ...(attachments ? { attachments } : {}),
      ...(role === 'assistant' && row.status === 'COMPLETE' && row.schema ? { draft: row.schema } : {}),
    };
  });

/** Send is allowed with text or a file, and never while a reply or an
 * upload is still in flight. */
export const canSendDraft = (text: string, staged: readonly DrawerAttachment[], awaiting: boolean, restoring: boolean): boolean =>
  !awaiting && !restoring && !staged.some((a) => a.status === 'uploading') && (text.trim().length > 0 || staged.length > 0);

/* -------------------------------------------------------------------------- */
/* Tube map (design view)                                                     */
/* -------------------------------------------------------------------------- */

export const TUBE_COPY = {
  search: 'Find a survey or stop',
  emptyTitle: 'No surveys to map yet',
  emptyBody: 'Build a survey and it appears here as a line.',
  noMatch: 'Nothing on the map matches that search.',
  errorTitle: 'Could not load the tube map',
  errorBody: 'The workflow service did not answer. Nothing has been lost — try again in a moment.',
  openSurvey: 'Open survey',
} as const;

export const SURVEY_STAGES = [
  { key: 'survey', label: '1 · Survey', hint: 'The survey' },
  { key: 'form', label: '2 · Form', hint: 'How it was built' },
  { key: 'audience', label: '3 · Audience', hint: 'Who it is for' },
  { key: 'delivery', label: '4 · Delivery', hint: 'How it went out' },
  { key: 'responses', label: '5 · Responses', hint: 'What came back' },
  { key: 'review', label: '6 · Review', hint: 'Who looked at it' },
  { key: 'result', label: '7 · Result', hint: 'The tally' },
] as const;
export type SurveyStageKey = (typeof SURVEY_STAGES)[number]['key'];

export const MAP_AUDIENCE_LABELS: Record<string, string> = {
  ALL_TENANT_USERS: 'Everyone in the workspace',
  SPECIFIC_TENANT_USERS: 'Chosen workspace users',
  ALL_CUSTOMERS: 'All customers',
  SPECIFIC_CUSTOMERS: 'Chosen customers',
  SEGMENT_TAG: 'A segment (not supported yet)',
};

export const MAP_RESPONSE_LABELS: Record<string, string> = {
  PENDING: 'Waiting',
  SEEN: 'Opened',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
};

export interface SurveyStop {
  id: string;
  stage: SurveyStageKey;
  label: string;
  sublabel: string | null;
  /** Needs a look / not there yet — drawn hollow and dashed. */
  dashed: boolean;
}

const sumCounts = (c: Record<string, number>) => Object.values(c ?? {}).reduce((n, x) => n + (x ?? 0), 0);

/** Web's `surveyJourney.stopsOf`, stop for stop. */
export const surveyStops = (s: SmSurveyWire): SurveyStop[] => {
  const state = STATUS_LABEL[s.status as SurveyStatus] ?? s.status;
  const stops: SurveyStop[] = [
    {
      id: `survey:${s.id}`,
      stage: 'survey',
      label: s.title,
      sublabel: `${state} · ${s.evaluationMode === 'AI' ? 'AI review' : 'Manual review'}`,
      dashed: s.status === 'DRAFT' || s.status === 'ARCHIVED' || s.status === 'PAUSED',
    },
  ];
  const ai = (s.versions?.aiDrafted ?? 0) > 0 || (s.aiChatMessages ?? 0) > 0;
  stops.push(
    (s.versions?.total ?? 0) === 0
      ? { id: 'form:none', stage: 'form', label: 'No form yet', sublabel: null, dashed: true }
      : { id: ai ? 'form:ai' : 'form:manual', stage: 'form', label: ai ? 'Drafted with AI' : 'Built by hand', sublabel: 'Form', dashed: false },
  );
  stops.push(
    s.audience === null
      ? { id: 'aud:none', stage: 'audience', label: 'No audience', sublabel: 'Nobody chosen yet', dashed: true }
      : { id: `aud:${s.audience}`, stage: 'audience', label: MAP_AUDIENCE_LABELS[s.audience] ?? s.audience, sublabel: 'Audience', dashed: s.audience === 'SEGMENT_TAG' },
  );
  const sched = s.schedule;
  if (sched?.enabled) {
    stops.push({ id: `deliv:${sched.mode}`, stage: 'delivery', label: sched.mode === 'RECURRING' ? 'Scheduled · recurring' : 'Scheduled · one time', sublabel: 'Waiting for its time', dashed: false });
  } else if ((s.runs?.total ?? 0) > 0) {
    stops.push({ id: 'deliv:sent', stage: 'delivery', label: 'Sent', sublabel: sched ? 'Schedule has run' : 'Sent straight away', dashed: false });
  } else {
    stops.push({ id: 'deliv:none', stage: 'delivery', label: 'Not sent', sublabel: 'Nobody has been asked', dashed: true });
  }
  const assignments = s.assignments ?? {};
  const present = ASSIGNMENT_STATUS_ORDER.filter((k) => (assignments[k] ?? 0) > 0);
  if (present.length === 0) stops.push({ id: 'resp:none', stage: 'responses', label: 'Nobody asked yet', sublabel: null, dashed: true });
  for (const k of present) {
    stops.push({ id: `resp:${k}`, stage: 'responses', label: MAP_RESPONSE_LABELS[k] ?? k, sublabel: 'Response state', dashed: k === 'EXPIRED' || k === 'PENDING' });
  }
  const { total, reviewed, evaluation } = s.responses ?? { total: 0, reviewed: 0, evaluation: {} };
  if (total === 0) {
    stops.push({ id: 'rev:none', stage: 'review', label: 'Nothing to review', sublabel: 'No responses yet', dashed: true });
  } else if (s.evaluationMode === 'AI') {
    const done = evaluation?.DONE ?? 0;
    const failed = evaluation?.FAILED ?? 0;
    if (failed > 0) stops.push({ id: 'rev:ai-failed', stage: 'review', label: 'AI evaluation failed', sublabel: 'Needs a look', dashed: true });
    else if (done >= total) stops.push({ id: 'rev:ai-done', stage: 'review', label: 'Evaluated by AI', sublabel: 'Every response', dashed: false });
    else stops.push({ id: 'rev:ai-waiting', stage: 'review', label: 'Awaiting AI', sublabel: 'Not every response is evaluated', dashed: true });
  } else if (reviewed >= total) {
    stops.push({ id: 'rev:manual-done', stage: 'review', label: 'Reviewed by hand', sublabel: 'Every response', dashed: false });
  } else {
    stops.push({ id: 'rev:manual-waiting', stage: 'review', label: 'Awaiting review', sublabel: 'By hand', dashed: true });
  }
  const asked = sumCounts(assignments);
  const completed = assignments.COMPLETED ?? 0;
  stops.push({
    id: `result:${s.id}`,
    stage: 'result',
    label: `${asked} asked · ${completed} done`,
    sublabel: s.runs?.lastAt ? `Last sent ${s.runs.lastAt.slice(0, 10)}` : null,
    dashed: asked === 0,
  });
  return stops;
};

/** A survey line matches when its title or any of its stops does. */
export const filterSurveyLines = (surveys: readonly SmSurveyWire[], query: string): SmSurveyWire[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...surveys];
  return surveys.filter((s) => s.title.toLowerCase().includes(q) || surveyStops(s).some((st) => st.label.toLowerCase().includes(q) || (st.sublabel ?? '').toLowerCase().includes(q)));
};
