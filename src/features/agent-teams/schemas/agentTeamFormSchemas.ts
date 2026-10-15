import * as yup from 'yup';

import { MAX_TEAM_AGENTS, SCHEDULE_OBJECTIVE_MAX, TEAM_NAME_MAX, TEAM_PURPOSE_MAX, THREAD_TITLE_MAX } from '../agentTeamsRules';

/**
 * Every Agents Teams form, with the SAME rules and the SAME messages web's
 * `FormModal` builds from its field config (`useFormModal.tsx`'s
 * `buildSchema`): a non-optional text field is `"{Label} is required"`, a
 * `maxLength` is `"{Label} cannot be longer than {n} characters"`, a
 * required checklist is `.min(1, "{Label} is required")` and its `maxItems`
 * is `"{Label}: pick at most {n}"`. Messages were confirmed live on
 * b2b-fe.aidraftsman.ai on 2026-10-15.
 */

const agentIds = () =>
  yup
    .array()
    .of(yup.string().required())
    .min(1, 'Agents is required')
    .max(MAX_TEAM_AGENTS, `Agents: pick at most ${MAX_TEAM_AGENTS}`)
    .required('Agents is required');

/* --- New team / Edit team ------------------------------------------------- */

export const agentTeamFormSchema = yup.object({
  name: yup.string().trim().required('Team name is required').max(TEAM_NAME_MAX, `Team name cannot be longer than ${TEAM_NAME_MAX} characters`),
  /* Optional: left blank, the server uses the name. */
  purpose: yup.string().trim().max(TEAM_PURPOSE_MAX, `Purpose cannot be longer than ${TEAM_PURPOSE_MAX} characters`).default(''),
  agentIds: agentIds(),
});

export type AgentTeamFormValues = { name: string; purpose: string; agentIds: string[] };

export const AGENT_TEAM_FORM_DEFAULTS: AgentTeamFormValues = { name: '', purpose: '', agentIds: [] };

/* --- Add a specialist ----------------------------------------------------- */

export const addMemberSchema = yup.object({
  agentId: yup.string().trim().required('Agent is required'),
});

export type AddMemberFormValues = { agentId: string };

/* --- Schedule this team --------------------------------------------------- */

export const scheduleFormSchema = yup.object({
  preset: yup.string().trim().required('How often is required'),
  /* Optional — '' means "New thread for this schedule". */
  conversationId: yup.string().default(''),
  objective: yup
    .string()
    .trim()
    .required('What should the team do is required')
    .max(SCHEDULE_OBJECTIVE_MAX, `What should the team do cannot be longer than ${SCHEDULE_OBJECTIVE_MAX} characters`),
  /* Optional — omitted rather than sent empty; the server defaults it. */
  timezone: yup.string().default(''),
});

export type ScheduleFormValues = { preset: string; conversationId: string; objective: string; timezone: string };

/* --- New team chat -------------------------------------------------------- */

export const teamChatSchema = yup.object({
  name: yup.string().trim().max(THREAD_TITLE_MAX, `Thread name cannot be longer than ${THREAD_TITLE_MAX} characters`).default(''),
  agentIds: agentIds(),
  knowledgeBaseId: yup.string().default(''),
});

export type TeamChatFormValues = { name: string; agentIds: string[]; knowledgeBaseId: string };
