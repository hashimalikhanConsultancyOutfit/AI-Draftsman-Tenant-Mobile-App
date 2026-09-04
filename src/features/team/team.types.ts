/**
 * Team — types. Mirrors the gateway's real contract exactly (confirmed
 * against `apps/gateway-b2b/src/app/team/{team.controller,dto/*}.ts` and
 * `apps/b2b-core/src/app/team/team.service.ts` on 2026-09-04).
 *
 * `GET /team` and `GET /team/roles` both return `{ items: [...] }` but take
 * no page/limit/search params — the roster is bounded by headcount, not by
 * a list that needs paging, and the gateway 400s on an unknown query param
 * rather than silently ignoring it. So, like API keys, there is no
 * page-wrapper type here — filtering is entirely client-side.
 */

export type TeamMemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

/** One unified shape for both accepted members and pending invites — an
 * invited person is a real user row with a real role from the moment
 * they're invited, so an owner can audit what was granted before anyone
 * accepts. */
export interface TeamMember {
  /** The user id — every route is `/team/{userId}`, not a membership id. */
  id: string;
  email: string;
  name: string | null;
  /** Lower-case tenant role name, e.g. `"admin"` — not an id+name pair. */
  role: string;
  /** Derived, informational only — never an authorization input. */
  level: 'USER' | 'MANAGEMENT';
  status: TeamMemberStatus;
  /** True only once a real TOTP code has been verified, not merely a
   * generated secret. */
  mfaEnrolled: boolean;
  lastLoginAt: string | null;
  /** Customer ids this member is scoped to; empty = whole workspace. */
  customerScope: string[];
  acceptedAt: string | null;
  /** The invitation date (membership `createdAt`). */
  invitedAt: string;
  /** User id of the inviter, or null for the founding Owner. */
  invitedBy: string | null;
}

export interface TeamRole {
  name: string;
  isSystem: boolean;
  /** Current memberships on this role, invitations included. */
  memberCount: number;
}

export interface InviteTeamMemberBody {
  email: string;
  roleName: string;
  name?: string;
  customerScope?: string[];
}

export interface UpdateTeamMemberRoleBody {
  id: string;
  roleName: string;
}

/** `POST /team` response — the accept link is minted fresh every time and
 * never stored, so this is the only place it's ever handed back. */
export interface InvitedTeamMember {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  level: 'USER' | 'MANAGEMENT';
  customerScope: string[];
  status: TeamMemberStatus;
  expiresAt: string;
  emailSent: boolean;
  ssoAvailable: boolean;
  acceptUrl: string;
}

export interface InviteLink {
  acceptUrl: string;
  expiresAt: string;
}

export interface ResendInviteResult {
  email: string;
  emailSent: boolean;
  acceptUrl: string;
  expiresAt: string;
}

export interface RemovedTeamMember {
  id: string;
  /** true = an outstanding invitation was withdrawn; false = an accepted
   * member was removed. Drives which toast/copy the caller shows. */
  withdrawn: boolean;
}
