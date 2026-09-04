/**
 * Account — RTK Query endpoints, injected into the shared `api` slice.
 * Mirrors gateway-b2b's real routes exactly (confirmed against
 * `apps/gateway-b2b/src/app/auth/my-settings/my-settings.controller.ts`
 * and web's own `src/store/api/mySettings.api.ts`, 2026-09-04): one read,
 * three writes, all scoped to the caller by the session token — no id is
 * ever sent.
 *
 * `uploadAvatar`'s body is `FormData`; this is the app's second multipart
 * write after Branding's logo upload, and reuses the same `httpClient.ts`
 * behaviour (skip the JSON `Content-Type`/`JSON.stringify` for a
 * `FormData` body).
 *
 * `changePassword` answers 204 with no body — `void` on both sides — and
 * carries no cache tags: nothing this app renders is derived from a
 * password, and the caller is responsible for signing out afterwards
 * (`ChangePasswordScreen` does, via `useLogoutMutation`), which resets
 * the whole query cache anyway.
 */

import { api } from '@/store/api';

import type { AccountSettings, ChangePasswordRequest, UpdateAccountRequest } from './account.types';

export const accountApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAccount: builder.query<AccountSettings, void>({
      query: () => ({ url: '/auth/my-settings/account' }),
      providesTags: [{ type: 'Account', id: 'SELF' }],
    }),

    /** Send only the field(s) being changed — an absent field is left
     * alone; see `AccountFieldFormScreen`, which always sends exactly
     * one. Invalidates rather than writing the response by hand, since
     * the account comes back as STORED (trimmed name, lower-cased
     * handle), not as submitted. */
    updateAccount: builder.mutation<AccountSettings, UpdateAccountRequest>({
      query: (body) => ({ url: '/auth/my-settings/account', method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Account', id: 'SELF' }],
    }),

    /** `body` is a `FormData` with one field, `file`. */
    uploadAvatar: builder.mutation<AccountSettings, FormData>({
      query: (body) => ({ url: '/auth/my-settings/account/avatar', method: 'POST', body }),
      invalidatesTags: [{ type: 'Account', id: 'SELF' }],
    }),

    /** Idempotent server-side — removing an avatar that isn't there is
     * still a 200. */
    removeAvatar: builder.mutation<AccountSettings, void>({
      query: () => ({ url: '/auth/my-settings/account/avatar', method: 'DELETE' }),
      invalidatesTags: [{ type: 'Account', id: 'SELF' }],
    }),

    changePassword: builder.mutation<void, ChangePasswordRequest>({
      query: (body) => ({ url: '/auth/my-settings/account/password', method: 'POST', body }),
    }),
  }),
});

export const {
  useGetAccountQuery,
  useUpdateAccountMutation,
  useUploadAvatarMutation,
  useRemoveAvatarMutation,
  useChangePasswordMutation,
} = accountApi;
