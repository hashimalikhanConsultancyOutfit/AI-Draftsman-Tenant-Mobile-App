/**
 * Playground — RTK Query endpoints, injected into the shared `api` slice.
 *
 * Mirrors the web app's `runPlayground` endpoint exactly (it lives in web's
 * `knowledgeBases.api.ts`, not a `playground.api.ts` — the route is
 * `POST /knowledge-bases/playground`, confirmed against
 * `apps/gateway-b2b/src/app/knowledge-bases/knowledge-bases.controller.ts`
 * on 2026-09-03: a stateless pass-through to the ML endpoint, with a
 * `served: 'dummy'` placeholder while that endpoint is unreachable).
 */

import { api } from '@/store/api';

export interface RunPlaygroundRequest {
  systemPrompt: string;
  useCase: string;
}

export interface RunPlaygroundResult {
  response: string;
  served: 'ml' | 'dummy';
}

export const playgroundApi = api.injectEndpoints({
  endpoints: (builder) => ({
    runPlayground: builder.mutation<RunPlaygroundResult, RunPlaygroundRequest>({
      query: (body) => ({ url: '/knowledge-bases/playground', method: 'POST', body }),
    }),
  }),
});

export const { useRunPlaygroundMutation } = playgroundApi;
