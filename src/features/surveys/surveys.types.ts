/**
 * Surveys — domain types, mirrored from the web app's
 * `src/types/survey.types.ts` and `surveyMap.types.ts`, and confirmed
 * against live `GET /surveys*` responses on 2026-10-15.
 *
 * A survey is built (a versioned form), targeted (an audience rule), sent
 * (now, or on a schedule) and reviewed (by a manager, or scored by AI
 * against a knowledge base).
 */

export const SURVEY_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

export type SurveyEvaluationMode = 'AI' | 'MANUAL';

export type SurveyAudienceRuleType = 'SPECIFIC_TENANT_USERS' | 'ALL_TENANT_USERS' | 'SPECIFIC_CUSTOMERS' | 'ALL_CUSTOMERS' | 'SEGMENT_TAG';

export const SURVEY_FIELD_KINDS = ['text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'multiselect', 'url', 'rating', 'boolean', 'section'] as const;
export type SurveyFieldKind = (typeof SURVEY_FIELD_KINDS)[number];

export interface SurveyField {
  key: string;
  kind: SurveyFieldKind;
  label: string;
  help?: string;
  required: boolean;
  options?: string[];
  validation?: { min?: number; max?: number; pattern?: string };
}

export interface SurveyVersion {
  id: string;
  versionNumber: number;
  schema: SurveyField[];
  generatedByAi: boolean;
  aiPromptText?: string | null;
  lockedAt: string | null;
}

export interface SurveyAudienceRule {
  ruleType: SurveyAudienceRuleType;
  criteria: Record<string, unknown> | null;
}

export interface Survey {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  evaluationMode: SurveyEvaluationMode;
  evaluationKnowledgeBaseId: string | null;
  currentVersionId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  /** Only on `GET /surveys/:id`. */
  versions?: SurveyVersion[];
  audienceRule?: SurveyAudienceRule | null;
}

/** CURSOR-paged. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  evaluationMode?: SurveyEvaluationMode;
  evaluationKnowledgeBaseId?: string;
  schema: SurveyField[];
}

export interface UpdateSurveyRequest {
  id: string;
  title?: string;
  description?: string;
  status?: SurveyStatus;
  evaluationMode?: SurveyEvaluationMode;
  evaluationKnowledgeBaseId?: string;
}

export interface SurveyAudiencePreview {
  eligibleCount: number;
  skippedCount: number;
  skippedReasons: Record<string, number>;
}

export interface SendSurveyNowResult {
  assignedCount: number;
  skippedCount: number;
  skippedReasons: Record<string, number>;
}

export interface SurveyAnswer {
  fieldKey: string;
  value: unknown;
}

export interface SurveyEvaluation {
  id: string;
  responseId: string;
  score: number | null;
  sentiment: string | null;
  tags: string[];
  summary: string | null;
  status: 'PENDING' | 'DONE' | 'FAILED';
  evaluatedAt: string | null;
  createdAt: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  versionId: string;
  assignmentId: string;
  submittedAt: string;
  answers: SurveyAnswer[];
  manualReview: { reviewed: boolean; reviewerId: string | null; manualRating: number | null; notes: string | null } | null;
  assignment: { id: string; principalType: string; principalId: string } | null;
  evaluationResult: SurveyEvaluation | null;
}

export interface ReviewSurveyResponseRequest {
  surveyId: string;
  responseId: string;
  reviewed: boolean;
  manualRating?: number;
  notes?: string;
}

export type SurveyScheduleMode = 'ONE_TIME' | 'RECURRING';
export type SchedulePreset = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface SurveySchedule {
  id: string;
  surveyId: string;
  mode: SurveyScheduleMode;
  cron: string | null;
  timezone: string;
  startAt: string | null;
  endAt: string | null;
  occurrenceLimit: number | null;
  occurrencesFired: number;
  enabled: boolean;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetSurveyScheduleRequest {
  id: string;
  mode: SurveyScheduleMode;
  timezone: string;
  startAt?: string;
  preset?: SchedulePreset;
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customCron?: string;
  endAt?: string;
  occurrenceLimit?: number;
}

export interface SurveyRun {
  id: string;
  dueAt: string;
  firedAt: string | null;
  eligibleCount: number;
  skippedCount: number;
  skippedReasons: Record<string, number>;
  status: 'COMPLETED' | 'FAILED';
}

export const SURVEY_ASSIGNMENT_STATUSES = ['PENDING', 'SEEN', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED'] as const;
export type SurveyAssignmentStatus = (typeof SURVEY_ASSIGNMENT_STATUSES)[number];

export interface SurveyDashboard {
  totalAssigned: number;
  byStatus: Record<SurveyAssignmentStatus, number>;
  completionRate: number;
  responseCount: number;
  reviewedCount: number;
  evaluatedCount: number;
  averageScore: number | null;
  lastRunAt: string | null;
  recentRuns: SurveyRun[];
}

/* ── AI drafting ─────────────────────────────────────────────────────────── */

export interface SurveyDraft {
  title: string;
  description: string;
  fields: Array<{ key: string; kind: SurveyFieldKind; label: string; help?: string; required: boolean; options?: string[] }>;
}

export interface SurveyChatMessage {
  role: 'user' | 'assistant';
  text: string;
  attachments?: Array<{ filename: string; blobUrl?: string }>;
}

export interface SurveyDraftReply {
  status: 'NEEDS_INPUT' | 'COMPLETE';
  message: string;
  schema?: SurveyDraft;
}

export interface SurveyChatHistoryMessage {
  role: 'USER' | 'ASSISTANT';
  text: string;
  attachments: Array<{ filename: string; blobUrl?: string }> | null;
  status: 'NEEDS_INPUT' | 'COMPLETE' | null;
  schema: SurveyDraft | null;
  createdAt: string;
}

/* ── People an audience can name ─────────────────────────────────────────── */

/** One row of `GET /onboarding/invites` — the workspace's members. */
export interface WorkspaceMember {
  userId: string;
  email: string;
  name: string | null;
  status: string;
}

/* ── The tube map — `GET /surveys/map` ───────────────────────────────────── */

export interface SmSurveyWire {
  id: string;
  title: string;
  status: string;
  evaluationMode: string;
  createdAt: string;
  versions: { total: number; aiDrafted: number };
  aiChatMessages: number;
  audience: string | null;
  schedule: { mode: string; enabled: boolean; occurrencesFired: number } | null;
  runs: { total: number; lastAt: string | null; eligible: number; skipped: number };
  assignments: Record<string, number>;
  responses: { total: number; reviewed: number; evaluation: Record<string, number> };
}

export interface SurveyMapResponse {
  surveys: SmSurveyWire[];
  total: number;
}

/* ── My Surveys — the respondent's side (`/my/surveys*`) ─────────────────── */

export interface MySurveyAssignment {
  id: string;
  surveyId: string;
  versionId: string;
  tenantId: string;
  principalType: string;
  principalId: string;
  status: SurveyAssignmentStatus;
  dueAt: string | null;
  seenAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  survey: { id: string; title: string; description: string | null };
  version: { id: string; schema: SurveyField[]; versionNumber: number };
  response?: { id: string; submittedAt: string; answers: SurveyAnswer[] } | null;
}

export interface MsSurveyWire {
  surveyId: string;
  title: string;
  /** How many times the caller was asked to fill this survey in. */
  asked: number;
  completed: number;
  latest: {
    status: string;
    dueAt: string | null;
    seenAt: string | null;
    completedAt: string | null;
    /** `SUPERSEDED_BY_NEWER_RUN` | `RECIPIENT_REMOVED` | null */
    expiredReason: string | null;
    createdAt: string;
  };
}

export interface MySurveyMapResponse {
  surveys: MsSurveyWire[];
}
