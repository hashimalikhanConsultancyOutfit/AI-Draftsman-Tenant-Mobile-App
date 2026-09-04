/**
 * ROLES & PERMISSIONS — types
 * =============================================================================
 * Confirmed against `apps/gateway-b2b/src/app/roles/{roles.controller.ts,
 * dto/role-request.dto.ts, dto/role-response.dto.ts}` and web's own
 * `src/types/role.types.ts` on 2026-09-04.
 *
 * `permissions` and `fullAccess` never disagree — the server's invariant is
 * `fullAccess === permissions.includes('*')`, both derived from one stored
 * token list. `permissionCount` is 1 for a full-access role (it holds one
 * token, `*`) — read `fullAccess`, never infer "everything" from the count.
 */

/** One selectable permission from `GET /permissions`. `id` is a stable list
 * key only — never sent back on any write; `slug` is the whole contract. */
export interface Permission {
  id: string;
  slug: string;
  label: string;
  description: string | null;
}

/** One module group of the catalogue, in the seed's own declaration order —
 * nothing on the client re-sorts. */
export interface PermissionModule {
  key: string;
  label: string;
  permissions: Permission[];
}

/** One row of `GET /roles`. */
export interface RoleSummary {
  id: string;
  /** The stored name — lower case, whitespace-collapsed. Never shown as-is;
   * see `toRoleDisplayName` in `rolesRules.ts`. */
  name: string;
  description: string | null;
  /** Seeded by provisioning (`owner`/`admin`/`builder`/`finance`/`member`).
   * All five refuse DELETE (409). All but `owner` refuse PATCH too except
   * for an Owner actor — `isSystem` alone no longer says "read-only"; see
   * `roleEditLocks`. */
  isSystem: boolean;
  /** Tokens held. `1` for a full-access role — read `fullAccess` instead. */
  permissionCount: number;
  fullAccess: boolean;
  /** How many people hold it. A role with members cannot be deleted. */
  memberCount: number;
  createdAt: string;
}

/** `GET /roles/:roleId` — the role plus the exact slugs it holds. */
export interface RoleDetail extends RoleSummary {
  /** Sorted, catalogue order. Exactly `['*']` for a full-access role. */
  permissions: string[];
}

export interface RoleListPage {
  items: RoleSummary[];
  /** Roles matching the query across every page, not just this one. */
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Query string for `GET /roles`. Only the set fields are sent — the
 * gateway runs `forbidNonWhitelisted`, so an explicit `undefined` in the
 * URL is a 400 rather than an ignored key. */
export interface RoleListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/** `POST /roles` body. `description` omitted rather than sent blank —
 * matches `toCreateBody` on web. `permissions` is already canonical:
 * `['*']` for full access, atomic slugs otherwise — never a mixture. */
export interface CreateRoleBody {
  name: string;
  description?: string;
  permissions: string[];
}

/** `PATCH /roles/:roleId` body. This form always submits the whole role
 * (name, description, permissions together, exactly like web's single
 * Add/Edit dialog does), so every field is present — `description` is
 * `null` for "no description" per the DTO's clear-vs-omit distinction. */
export interface UpdateRoleBody {
  name: string;
  description: string | null;
  permissions: string[];
}

export interface DeletedRole {
  id: string;
  deleted: boolean;
}
