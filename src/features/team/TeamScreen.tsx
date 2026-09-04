/**
 * TeamScreen — the member roster. Ported from web's `Team.tsx` / `useTeam.tsx`
 * (confirmed against that source 2026-09-04): entirely client-side search +
 * role + status filtering, no pagination (`GET /team` returns the whole
 * roster in one call, same reasoning as API keys — a team is bounded by
 * headcount, not by a list that needs paging). `user.view` gates the whole
 * screen; Resend/Copy-link ride on `user.invite`, Change role on
 * `user.assign_role`, Remove/Withdraw on `user.remove`.
 */

import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, StatusTabs, TextField, useToast } from '@/components/ui';
import { TEAM_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { TeamStackParamList } from '@/navigation/types';
import { InviteLinkModal, type InviteLinkInfo } from './components/InviteLinkModal';
import { MemberCard } from './components/MemberCard';
import { useGetTeamQuery, useGetTeamRolesQuery, useGetInviteLinkMutation, useRemoveTeamMemberMutation, useResendInviteMutation } from './teamApi';
import {
  ANY_ROLE,
  NO_ASSIGN_ROLE_MESSAGE,
  NO_CREATE_DESCRIPTION,
  NO_INVITE_MESSAGE,
  NO_REMOVE_MESSAGE,
  STATUS_TABS,
  buildRemoveWarning,
  buildResendSuccessNote,
  buildWithdrawWarning,
  isLastOwner,
  isPendingMember,
  toRoleLabel,
  type TeamStatusFilter,
} from './teamRules';
import type { TeamMember } from './team.types';

type Nav = NativeStackNavigationProp<TeamStackParamList>;

export function TeamScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(TEAM_PERMISSIONS.VIEW);
  const canInvite = usePermission(TEAM_PERMISSIONS.INVITE);
  const canAssignRole = usePermission(TEAM_PERMISSIONS.ASSIGN_ROLE);
  const canRemove = usePermission(TEAM_PERMISSIONS.REMOVE);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(ANY_ROLE);
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>('all');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copyingLinkId, setCopyingLinkId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<InviteLinkInfo | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useGetTeamQuery(undefined, { skip: !canView });
  const { data: roles } = useGetTeamRolesQuery(undefined, { skip: !canView });
  const [resendInvite] = useResendInviteMutation();
  const [getInviteLink] = useGetInviteLinkMutation();
  const [removeTeamMember] = useRemoveTeamMemberMutation();

  const team = data ?? [];

  const roleTabs = useMemo(() => [{ label: 'All roles', value: ANY_ROLE }, ...(roles ?? []).map((r) => ({ label: toRoleLabel(r.name), value: r.name }))], [roles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return team.filter((m) => {
      if (statusFilter === 'active' && isPendingMember(m)) return false;
      if (statusFilter === 'pending' && !isPendingMember(m)) return false;
      if (roleFilter && m.role !== roleFilter) return false;
      if (q && !`${m.name ?? ''} ${m.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [team, statusFilter, roleFilter, search]);

  const isFiltered = Boolean(search.trim()) || roleFilter !== ANY_ROLE || statusFilter !== 'all';

  const handleInvite = useCallback(() => {
    if (!canInvite) {
      toast.show(NO_INVITE_MESSAGE, { tone: 'warning' });
      return;
    }
    navigation.navigate('InviteMember');
  }, [canInvite, navigation, toast]);

  const handleChangeRole = useCallback(
    (member: TeamMember) => {
      if (!canAssignRole) {
        toast.show(NO_ASSIGN_ROLE_MESSAGE, { tone: 'warning' });
        return;
      }
      navigation.navigate('ChangeRole', { id: member.id, name: member.name, email: member.email, roleName: member.role });
    },
    [canAssignRole, navigation, toast],
  );

  const handleResend = useCallback(
    async (member: TeamMember) => {
      if (!canInvite) {
        toast.show(NO_INVITE_MESSAGE, { tone: 'warning' });
        return;
      }
      setResendingId(member.id);
      try {
        const result = await resendInvite(member.id).unwrap();
        const note = buildResendSuccessNote(member.name || member.email, result.email, result.emailSent);
        toast.show(note.message, { tone: note.tone });
        setLinkInfo({ email: result.email, acceptUrl: result.acceptUrl, expiresAt: result.expiresAt, emailSent: result.emailSent });
      } catch (err) {
        toast.show(getErrorMessage(err as never, 'Could not resend that invitation.'), { tone: 'error' });
      } finally {
        setResendingId(null);
      }
    },
    [canInvite, resendInvite, toast],
  );

  const handleCopyLink = useCallback(
    async (member: TeamMember) => {
      if (!canInvite) {
        toast.show(NO_INVITE_MESSAGE, { tone: 'warning' });
        return;
      }
      setCopyingLinkId(member.id);
      try {
        const link = await getInviteLink(member.id).unwrap();
        await Clipboard.setStringAsync(link.acceptUrl);
        toast.show('Link copied.', { tone: 'success' });
      } catch (err) {
        toast.show(getErrorMessage(err as never, 'Could not fetch that invite link.'), { tone: 'error' });
      } finally {
        setCopyingLinkId(null);
      }
    },
    [canInvite, getInviteLink, toast],
  );

  const handleRemove = useCallback(
    (member: TeamMember) => {
      if (!canRemove) {
        toast.show(NO_REMOVE_MESSAGE, { tone: 'warning' });
        return;
      }
      if (isLastOwner(team, member)) {
        toast.show('Blocked — this is the only remaining Owner. Promote someone else to Owner first.', { tone: 'warning' });
        return;
      }
      const pending = isPendingMember(member);
      const name = member.name || member.email;
      Alert.alert(pending ? 'Withdraw invitation?' : 'Remove member?', pending ? buildWithdrawWarning(name) : buildRemoveWarning(name, member.role), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: pending ? 'Withdraw' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(member.id);
            try {
              const result = await removeTeamMember(member.id).unwrap();
              toast.show(result.withdrawn ? `Invitation to ${name} withdrawn.` : `${name} removed.`, { tone: 'neutral' });
            } catch (err) {
              toast.show(getErrorMessage(err as never, `Could not ${pending ? 'withdraw that invitation' : 'remove that member'}.`), { tone: 'error' });
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]);
    },
    [canRemove, removeTeamMember, team, toast],
  );

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Team" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view the team" description={'Viewing the team roster needs the "View the team roster" permission. Ask an owner or an admin to grant it.'} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Team" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
              Who can reach this workspace, and what each of them may do.
            </Text>

            {canInvite ? <Button label="Invite member" icon="add" onPress={handleInvite} fullWidth /> : null}

            <TextField placeholder="Search by name or email" leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
            <StatusTabs tabs={roleTabs} value={roleFilter} onChange={setRoleFilter} />
            <StatusTabs tabs={STATUS_TABS} value={statusFilter} onChange={(v) => setStatusFilter(v as TeamStatusFilter)} />

            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
              {!isLoading && !error ? `${filtered.length} member${filtered.length === 1 ? '' : 's'}` : 'Team'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            team={team}
            canInvite={canInvite}
            canAssignRole={canAssignRole}
            canRemove={canRemove}
            isResending={resendingId === item.id}
            isCopyingLink={copyingLinkId === item.id}
            isRemoving={removingId === item.id}
            onResend={() => handleResend(item)}
            onCopyLink={() => handleCopyLink(item)}
            onChangeRole={() => handleChangeRole(item)}
            onRemove={() => handleRemove(item)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <ErrorState title="Could not load your team" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
          ) : isFiltered ? (
            <EmptyState icon="search-off" title="No members match your filters" description="Try a different search term, or clear the filters to see everyone in the workspace." />
          ) : (
            <EmptyState
              icon="team"
              title="No members"
              description={canInvite ? 'Invite someone and they appear here immediately, marked as invited until they accept.' : NO_CREATE_DESCRIPTION}
              actionLabel={canInvite ? 'Invite member' : undefined}
              onAction={canInvite ? handleInvite : undefined}
            />
          )
        }
      />

      <InviteLinkModal info={linkInfo} onDismiss={() => setLinkInfo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 12 },
});
