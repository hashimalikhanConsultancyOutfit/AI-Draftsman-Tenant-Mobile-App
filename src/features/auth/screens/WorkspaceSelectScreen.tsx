import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { Button, Card, Icon } from '@/components/ui';
import { isOwnerRole, toRoleLabel } from '@/features/team/teamRules';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { clearAllCookies } from '@/services/cookieAuth';
import { useSelectWorkspaceMutation } from '@/store/authApi';
import { otpFlowReset } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

/** Shown after OTP for accounts that belong to more than one workspace —
 * the session cookie is only issued once one is chosen, after which the
 * auth phase flips to `authenticated` and the main stack mounts. */
export function WorkspaceSelectScreen() {
  const { theme } = useAppTheme();
  const dispatch = useAppDispatch();
  const pending = useAppSelector((state) => state.auth.pendingWorkspaces);
  const [selectWorkspace, { isLoading, error, originalArgs }] = useSelectWorkspaceMutation();

  if (!pending) return null;

  const handleBack = async () => {
    await clearAllCookies();
    dispatch(otpFlowReset());
  };

  return (
    <AuthScreenLayout
      eyebrow="Choose workspace"
      title="Where to?"
      subtitle={`${pending.email} is a member of ${pending.workspaces.length} workspaces. You can switch between them later without signing in again.`}
    >
      <View style={{ gap: theme.space('md') }}>
        {pending.workspaces.map((workspace) => {
          const owner = isOwnerRole(workspace.role);
          const isThisLoading = isLoading && originalArgs?.handle === workspace.handle;
          return (
            <TouchableOpacity
              key={workspace.handle}
              accessibilityRole="button"
              accessibilityLabel={`Open ${workspace.name}, ${toRoleLabel(workspace.role)}`}
              disabled={isLoading}
              onPress={() => selectWorkspace({ handle: workspace.handle })}
              activeOpacity={0.7}
              style={{ opacity: isLoading && !isThisLoading ? 0.5 : 1 }}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space('md') }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radii.full,
                    backgroundColor: theme.colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }}>
                    {initialsOf(workspace.name)}
                  </Text>
                </View>

                <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }}
                  >
                    {workspace.name}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: theme.radii.full,
                      backgroundColor: owner ? theme.colors.statusInfoBg : theme.colors.statusNeutralBg,
                    }}
                  >
                    <Text
                      style={{
                        color: owner ? theme.colors.statusInfoFg : theme.colors.statusNeutralFg,
                        fontFamily: theme.fontFamilies.body.semibold,
                        fontSize: 11,
                      }}
                    >
                      {toRoleLabel(workspace.role)}
                    </Text>
                  </View>
                </View>

                {isThisLoading ? (
                  <ActivityIndicator color={theme.colors.accent} />
                ) : (
                  <Icon name="chevron-right" size={24} color={theme.colors.textMuted} />
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && (
        <Text
          style={{
            color: theme.colors.error,
            fontFamily: theme.fontFamilies.body.regular,
            fontSize: theme.fontSizes.sm,
            textAlign: 'center',
          }}
        >
          {getErrorMessage(error, 'Could not open that workspace. Sign in again.')}
        </Text>
      )}

      <Button label="Back to sign in" onPress={handleBack} variant="outline" disabled={isLoading} fullWidth />
    </AuthScreenLayout>
  );
}
