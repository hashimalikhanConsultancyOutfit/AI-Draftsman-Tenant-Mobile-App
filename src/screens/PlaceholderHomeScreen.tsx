import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { useHasFullAccess } from '@/permissions';
import { useLogoutMutation } from '@/store/authApi';
import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * Stands in for the real AppDrawer/5-tab shell until Phase 3 (navigation
 * shell) and Phase 4 (Dashboard) are approved to start — see the standing
 * instruction to ask permission before each new module. This exists so the
 * auth flow (Phase 1-2) is fully exercisable end to end: sign in, verify,
 * see the real session snapshot and permission set, sign out.
 */
export function PlaceholderHomeScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const session = useAppSelector((state) => state.auth.session);
  const hasFullAccess = useHasFullAccess();
  const [logout, { isLoading }] = useLogoutMutation();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.space('lg'), paddingTop: insets.top + theme.space('lg'), gap: theme.space('lg') }}
    >
      <View>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Signed in
        </Text>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes['2xl'], marginTop: 4 }}>
          {session?.name ?? 'Unknown user'}
        </Text>
      </View>

      <Card>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>
          {session?.email}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 4 }}>
          Role: {session?.role?.name ?? '—'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 4 }}>
          {hasFullAccess ? 'Full access (*)' : `${session?.rolePermissions.length ?? 0} permission token(s)`}
        </Text>
      </Card>

      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
        The portal shell (dashboard, tabs and sidebar) lands in the next phase. Auth is fully wired: session bootstrap, permission
        resolution, and sign-out all hit the real API.
      </Text>

      <Button label="Sign out" onPress={() => logout()} loading={isLoading} variant="danger" icon="logout" />
    </ScrollView>
  );
}
