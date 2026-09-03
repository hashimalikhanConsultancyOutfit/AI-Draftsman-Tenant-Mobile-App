import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from './baseQuery';

/**
 * The shared portal api slice — every non-auth endpoint (dashboard,
 * customers, chat, agents, ...) injects into this one via
 * `api.injectEndpoints`, RTK Query's recommended pattern for a large,
 * feature-sharded API surface. One reducer/middleware pair for the whole
 * portal instead of one per feature, while each feature file still owns
 * its own endpoint definitions and cache tags.
 *
 * `authApi` (src/store/authApi.ts) stays separate deliberately — auth
 * state lives in authSlice via onQueryStarted, not the query cache, and
 * its endpoints (credentials/otp/totp/session) are meaningfully a
 * different lifecycle from everything behind the authenticated shell.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Dashboard',
    'TenantSummary',
    'Notifications',
    'CustomerStats',
    'Limits',
    'Agent',
    'Clone',
    'Customer',
    'CustomerImport',
    'KnowledgeBase',
    'Connector',
    'ConnectorInstall',
    'SkillCategory',
    'AgentCategory',
    'MarketplaceSkill',
    'MarketplaceAgent',
    'ChatThread',
    /* Keyed by conversationId — one transcript entry per thread. */
    'ChatMessage',
    'ChatBalance',
    'ChatModels',
    'Lead',
    'LeadAttachment',
    'LeadCriteria',
    'LeadEvaluationCriterion',
    'Report',
  ],
  endpoints: () => ({}),
});
