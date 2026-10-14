import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { clearAllCookies } from '@/services/cookieAuth';
import { useSelectWorkspaceMutation } from '@/store/authApi';
import { otpFlowReset } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { AuthScreenLayout } from '../components/AuthScreenLayout';

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

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
    <AuthScreenLayout title="Choose a workspace" subtitle="Where would you like to go?">
      <View style={{ alignItems: 'center', gap: theme.space('md') }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.statusNeutralBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="domain" size={32} color={theme.colors.statusNeutralFg} />
        </View>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontFamily: theme.fontFamilies.body.regular,
            fontSize: theme.fontSizes.sm,
            textAlign: 'center',
          }}
        >
          Your account is a member of more than one workspace. Open the one you want — you can move between them afterwards without signing in again.
        </Text>
        <Text
          style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, textAlign: 'center' }}
        >
          Signed in as {pending.email}
        </Text>
      </View>

      <View style={{ gap: theme.space('sm'), marginTop: theme.space('md') }}>
        {pending.workspaces.map((workspace) => {
          const isThisLoading = isLoading && originalArgs?.handle === workspace.handle;
          return (
            <TouchableOpacity
              key={workspace.handle}
              accessibilityRole="button"
              accessibilityLabel={`Open ${workspace.name}, ${workspace.role}`}
              disabled={isLoading}
              onPress={() => selectWorkspace({ handle: workspace.handle })}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: theme.space('md'),
                paddingHorizontal: theme.space('lg'),
                borderRadius: theme.radii.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                opacity: isLoading && !isThisLoading ? 0.5 : 1,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }}>
                  {workspace.name}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                  {capitalise(workspace.role)}
                </Text>
              </View>
              {isThisLoading ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Icon name="arrow-forward" size={20} color={theme.colors.text} />
              )}
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

      <TouchableOpacity onPress={handleBack} style={{ alignSelf: 'center', marginTop: theme.space('md') }}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
          Back to sign in
        </Text>
      </TouchableOpacity>
    </AuthScreenLayout>
  );
}
