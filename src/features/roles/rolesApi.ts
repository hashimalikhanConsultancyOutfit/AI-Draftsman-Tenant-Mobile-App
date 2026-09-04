/**
 * Roles & Permissions — RTK Query endpoints, injected into the shared `api`
 * slice. Mirrors gateway-b2b's real routes exactly (confirmed against
 * `apps/gateway-b2b/src/app/roles/roles.controller.ts` and
 * `src/store/api/roles.api.ts` on the web side, 2026-09-04): list, get,
 * create, update, delete, plus the permission catalogue at its own root
 * (`/permissions`, not nested under `/roles` — the catalogue is not a
 * property of any role).
 */

import { authApi } from '@/store/authApi';
import { api } from '@/store/api';

import { toRoleDisplayName } from './rolesRules';
import type { CreateRoleBody, DeletedRole, PermissionModule, RoleDetail, RoleListPage, RoleListParams, RoleSummary, UpdateRoleBody } from './roles.types';

/** Wire shapes, before display-name mapping. */
interface RoleSummaryWire extends Omit<RoleSummary, 'name'> {
  name: string;
}
interface RoleDetailWire extends RoleSummaryWire {
  permissions: string[];
}
interface RoleListWire {
  items: RoleSummaryWire[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const toRole = (wire: RoleSummaryWire): RoleSummary => ({
  ...wire,
  name: toRoleDisplayName(wire.name),
});

const toRoleDetail = (wire: RoleDetailWire): RoleDetail => ({
  ...toRole(wire),
  permissions: wire.permissions,
});

export const rolesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /** Global, not per-tenant — `b2b_permission` has no `tenantId`, so
     * every workspace sees the same rows. Fetched live rather than from
     * mobile's own bundled `PERMISSION_CATALOGUE` reference copy: web
     * deliberately never bundles this list, because a bundled copy can
     * drift from what the deployed backend actually seeded (offering a
     * checkbox for something the server refuses, or hiding one it
     * allows) — the Add/Edit Role screen is exactly the place that risk
     * matters, so it reads the real thing. */
    getPermissionCatalogue: builder.query<PermissionModule[], void>({
      query: () => ({ url: '/permissions' }),
      providesTags: ['Permission'],
    }),

    /** One page of the workspace's roles. A workspace rarely holds more
     * than the five seeded plus a handful, so this is a single
     * unpaginated fetch (limit 100, the gateway's own ceiling) rather
     * than an infinite-scroll list — same reasoning as Team and API
     * Keys: bounded by headcount/catalogue size, not a list needing
     * pages. `search` matches name AND description, case-insensitively;
     * `?q=` is a 400 on this route. */
    getRoles: builder.query<RoleListPage, RoleListParams | void>({
      query: (params) => {
        const { page, limit, search, sortBy, sortOrder } = params ?? {};
        return {
          url: '/roles',
          params: {
            ...(page === undefined ? {} : { page }),
            limit: limit ?? 100,
            ...(search ? { search } : {}),
            ...(sortBy === undefined ? {} : { sortBy }),
            ...(sortOrder === undefined ? {} : { sortOrder }),
          },
        };
      },
      transformResponse: (wire: RoleListWire): RoleListPage => ({
        items: wire.items.map(toRole),
        total: wire.total,
        page: wire.page,
        limit: wire.limit,
        totalPages: wire.totalPages,
      }),
      providesTags: (result) => [...(result?.items ?? []).map((r) => ({ type: 'Role' as const, id: r.id })), { type: 'Role' as const, id: 'LIST' }],
    }),

    /** One role and the exact slugs it holds — its own request rather
     * than reading the row out of the list, since the list carries only
     * a tally. A role under another tenant is a 404, not a 403. */
    getRole: builder.query<RoleDetail, string>({
      query: (id) => ({ url: `/roles/${id}` }),
      transformResponse: toRoleDetail,
      providesTags: (_r, _e, id) => [{ type: 'Role', id }],
    }),

    /** Grants nobody anything until somebody is assigned to it from Team
     * — but the Team screen's role picker reads `/team/roles`, so a new
     * role has to invalidate `TeamRole` too or the picker won't offer it
     * until a remount. */
    createRole: builder.mutation<RoleDetail, CreateRoleBody>({
      query: (body) => ({ url: '/roles', method: 'POST', body }),
      transformResponse: toRoleDetail,
      invalidatesTags: [{ type: 'Role', id: 'LIST' }, 'TeamRole'],
    }),

    /**
     * Update a role's name, description or permission set — the
     * highest-privilege write on this surface: it rewrites what every
     * current holder may do.
     *
     * A role edit only reaches a LIVE session the next time that
     * session's permission claim is re-minted, which happens on
     * `GET /auth/session` and nowhere else — the session doesn't
     * re-resolve grants per request. Web hit exactly this bug (an admin
     * could save a permission change and watch nothing happen until a
     * full reload) and fixed it by forcing a session refetch after every
     * role update. Mirrored here: on success, force a background refetch
     * of `authApi`'s `getSession` so this device's own permission claims
     * stay live without asking the user to sign out and back in. This
     * only repairs the session running IN THIS APP — it cannot reach a
     * different device or a different signed-in user; theirs repairs on
     * their own next cold start, same one-bootstrap-per-launch bound
     * `getSession` already documents.
     */
    updateRole: builder.mutation<RoleDetail, { id: string; body: UpdateRoleBody }>({
      query: ({ id, body }) => ({ url: `/roles/${id}`, method: 'PATCH', body }),
      transformResponse: toRoleDetail,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Role', id }, { type: 'Role', id: 'LIST' }, 'TeamRole'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.endpoints.getSession.initiate(undefined, { subscribe: false, forceRefetch: true }));
        } catch {
          // Update failed — nothing to refresh.
        }
      },
    }),

    /** Refused with 409 for a system role and for a role with members,
     * 404 for one belonging to another tenant — all three carry a
     * server sentence worth showing as-is. */
    deleteRole: builder.mutation<DeletedRole, string>({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Role', id: 'LIST' }, 'TeamRole'],
    }),
  }),
});

export const { useGetPermissionCatalogueQuery, useGetRolesQuery, useGetRoleQuery, useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation } = rolesApi;
