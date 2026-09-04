/**
 * Team — pure rules and copy. Ported verbatim where the string is
 * user-facing (confirmed against web's `Team.data.ts` / `useTeam.tsx` and
 * `apps/b2b-core/src/app/team/team.service.ts` on 2026-09-04).
 */

import type { TeamMember, TeamRole } from './team.types';

/** Server-side, lower-case: `OWNER_ROLE_NAME = 'owner'` in `team.entity.ts`.
 * Roles are per-tenant rows, not a fixed enum, but this one name is always
 * seeded and always means the same thing. */
export const OWNER_ROLE_NAME = 'owner';

export const isOwnerRole = (role: string): boolean => role.toLowerCase() === OWNER_ROLE_NAME;

/** "admin" -> "Admin", "owner" -> "Owner" — display only; every write still
 * sends the lower-case wire form. */
export const toRoleLabel = (role: string): string => (role.length > 0 ? role.charAt(0).toUpperCase() + role.slice(1) : role);

/* -------------------------------------------------------------------------- */
/* The last-Owner guard (client mirror — a courtesy, not the guarantee)      */
/* -------------------------------------------------------------------------- */

export const countOwners = (team: TeamMember[]): number => team.filter((m) => isOwnerRole(m.role)).length;

/** The real guarantee is server-side, inside the same transaction as the
 * write (closes the TOCTOU race two concurrent demotions/removals would
 * otherwise open) — this mirror exists only so the button can be disabled
 * and explained before a round trip, exactly as web does. */
export const isLastOwner = (team: TeamMember[], member: TeamMember): boolean => isOwnerRole(member.role) && countOwners(team) === 1;

/** Owner is withheld from every role picker on this screen — not a server
 * restriction (`PATCH` would accept `roleName: "owner"` if it reached the
 * API), a product one: ownership is transferred, not edited from a list. */
export const toAssignableRoles = (roles: TeamRole[]): TeamRole[] => roles.filter((r) => !isOwnerRole(r.name));

/* -------------------------------------------------------------------------- */
/* Status + labels                                                           */
/* -------------------------------------------------------------------------- */

export const isPendingMember = (member: TeamMember): boolean => member.status === 'INVITED';

export type TeamStatusFilter = 'all' | 'active' | 'pending';

export const STATUS_TABS: { label: string; value: TeamStatusFilter }[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active members', value: 'active' },
  { label: 'Pending invitations', value: 'pending' },
];

export const ANY_ROLE = '';

/* -------------------------------------------------------------------------- */
/* Modal copy                                                                */
/* -------------------------------------------------------------------------- */

export const INVITE_MODAL_COPY = {
  title: 'Invite member',
  description: 'They receive an invitation and appear in the list immediately, marked as invited until they accept.',
  submitLabel: 'Send invite',
} as const;

export const CHANGE_ROLE_MODAL_COPY = {
  title: 'Change role',
  description: 'Permissions are evaluated on every request, so a role change lands on the next call rather than waiting for a new session.',
  submitLabel: 'Change role',
} as const;

export const ROLE_CHANGE_NOTE = "Role updated — it applies on their next request, not their next login. Anything already in flight finishes under the old role.";

export const OWNER_ROLE_LOCKED_MESSAGE =
  "An Owner's role cannot be changed here. Ownership is transferred rather than edited — ask an Owner to appoint whoever should hold it.";

export const LAST_OWNER_BLOCKED_MESSAGE =
  'Blocked — this is the only remaining Owner. A workspace with no Owner has nobody who can appoint one, so promote someone else to Owner first.';

/** The reason shown under a disabled Remove/Withdraw button — mirrors
 * web's tooltip logic exactly, just rendered as caption text instead. */
export const removeDisabledReason = (member: TeamMember, team: TeamMember[], canRemove: boolean): string | null => {
  if (isLastOwner(team, member)) return 'The only Owner cannot be removed — promote someone else first.';
  if (!canRemove) return 'You do not have permission to remove members from this workspace.';
  return null;
};

export const buildRemoveWarning = (name: string, role: string): string =>
  `${name} (${toRoleLabel(role)}) loses access immediately. Anything they created — agents, reports, tickets — stays in the workspace and is not reassigned. Their audit history is kept.`;

export const buildWithdrawWarning = (name: string): string =>
  `${name} has not accepted yet, so this withdraws the invitation and their link stops working. They have never signed in, so nothing of theirs is affected — and you can invite the same address again afterwards.`;

export const buildInviteSuccessNote = (who: string, role: string, email: string, emailSent: boolean): string =>
  emailSent ? `${who} invited as ${toRoleLabel(role)}. Invitation emailed to ${email}.` : `${who} invited as ${toRoleLabel(role)}.`;

export const buildResendSuccessNote = (who: string, email: string, emailSent: boolean): { message: string; tone: 'success' | 'warning' } =>
  emailSent
    ? { message: `Invitation resent to ${email}. Their link is good for another 7 days.`, tone: 'success' }
    : { message: `${who}'s invitation could not be emailed. Copy the link below and send it to them yourself.`, tone: 'warning' };

export const INVITE_LINK_COPY = {
  emailed: 'The invitation was emailed to them. Copy the link too if you would rather send it yourself — over Slack, say, in case the email is missed or filtered.',
  notSent: 'The invitation could not be emailed. Copy this link and send it to them yourself — it is the only way in until they use it, or you invite them again for a fresh one.',
} as const;

/* -------------------------------------------------------------------------- */
/* Authorisation copy                                                        */
/* -------------------------------------------------------------------------- */

export const NO_INVITE_MESSAGE = 'You do not have permission to invite team members.';
export const NO_ASSIGN_ROLE_MESSAGE = "You do not have permission to change a member's role.";
export const NO_REMOVE_MESSAGE = 'You do not have permission to remove members from this workspace.';

export const NO_CREATE_DESCRIPTION = 'No members yet. Inviting one needs the "Invite team members" permission — ask an owner or an admin to grant it.';

/* -------------------------------------------------------------------------- */
/* Error-copy fallbacks, keyed by HTTP status — used only when the server    */
/* sends no message body of its own.                                        */
/* -------------------------------------------------------------------------- */

export const teamErrorFallback = (status: number | undefined, action: string): string => {
  if (status === 400) return 'Some of those details were rejected. Check the highlighted fields.';
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'Your role cannot manage the team. Membership and roles sit behind a permission that only Owners and Admins hold.';
  if (status === 404) return 'That person is no longer a member — they may have been removed from another tab.';
  if (status === 409) return 'That is the only remaining Owner, or that person is already a member of this workspace.';
  if (status !== undefined && status >= 500) return `The server could not ${action} just now. Nothing was changed — try again in a moment.`;
  return `Could not ${action}.`;
};
