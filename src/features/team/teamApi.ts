/**
 * Team — RTK Query endpoints, injected into the shared `api` slice.
 * Mirrors the gateway's real controller exactly (confirmed against
 * `apps/gateway-b2b/src/app/team/team.controller.ts` on 2026-09-04): every
 * route, in order — list, roles, check-email, get, invite-link,
 * resend-invite, invite, update-role, remove. `force-mfa` is intentionally
 * not ported: it has no button on web either (removed at product-owner
 * request; the backend route is still live but out of this module's scope).
 */

import { api } from '@/store/api';

import type {
  InviteLink,
  InviteTeamMemberBody,
  InvitedTeamMember,
  RemovedTeamMember,
  ResendInviteResult,
  TeamMember,
  TeamRole,
  UpdateTeamMemberRoleBody,
} from './team.types';

export const teamApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** Not paginated and takes no params — see the type file's header note. */
    getTeam: builder.query<TeamMember[], void>({
      query: () => ({ url: '/team' }),
      transformResponse: (response: { items: TeamMember[] }) => response.items,
      providesTags: (result) => [
        ...(result ?? []).map((m) => ({ type: 'TeamMember' as const, id: m.id })),
        { type: 'TeamMember' as const, id: 'LIST' },
      ],
    }),

    /** Ordered default-first then alphabetical server-side; a role's own
     * picker needs this even without ever opening the roster (e.g. seeding
     * the invite form). */
    getTeamRoles: builder.query<TeamRole[], void>({
      query: () => ({ url: '/team/roles' }),
      transformResponse: (response: { items: TeamRole[] }) => response.items,
      providesTags: [{ type: 'TeamRole', id: 'LIST' }],
    }),

    /** A courtesy check before submit, not the source of truth — `POST
     * /team` still re-validates and 409s independently. Modelled as a
     * mutation (not a cached query) since it's invoked once, right before
     * a specific submit, never subscribed to by a screen. */
    checkTeamEmail: builder.mutation<boolean, string>({
      query: (email) => ({ url: '/team/check-email', query: { email } }),
    }),

    inviteTeamMember: builder.mutation<InvitedTeamMember, InviteTeamMemberBody>({
      query: (body) => ({ url: '/team', method: 'POST', body }),
      invalidatesTags: [{ type: 'TeamMember', id: 'LIST' }],
    }),

    /** A fresh link only — mints a new token, sends no email, changes
     * nothing about the invitation. Not cached: the token is signed fresh
     * server-side on every call and never stored, so a cached response
     * would hand out a link this same query already knows is stale the
     * moment a second call is made. */
    getInviteLink: builder.mutation<InviteLink, string>({
      query: (id) => ({ url: `/team/${id}/invite-link` }),
    }),

    /** Unlike `getInviteLink`, this SENDS the email — role, scope, level
     * and inviter are all left untouched; only the token and its 7-day
     * expiry are refreshed. */
    resendInvite: builder.mutation<ResendInviteResult, string>({
      query: (id) => ({ url: `/team/${id}/resend-invite`, method: 'POST' }),
    }),

    updateTeamMemberRole: builder.mutation<TeamMember, UpdateTeamMemberRoleBody>({
      query: ({ id, roleName }) => ({ url: `/team/${id}`, method: 'PATCH', body: { roleName } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'TeamMember', id }, { type: 'TeamMember', id: 'LIST' }],
    }),

    /** A removal (active member) or a withdrawal (pending invite) — the
     * server decides which and reports it back via `withdrawn`. */
    removeTeamMember: builder.mutation<RemovedTeamMember, string>({
      query: (id) => ({ url: `/team/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TeamMember', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTeamQuery,
  useGetTeamRolesQuery,
  useCheckTeamEmailMutation,
  useInviteTeamMemberMutation,
  useGetInviteLinkMutation,
  useResendInviteMutation,
  useUpdateTeamMemberRoleMutation,
  useRemoveTeamMemberMutation,
} = teamApi;
