import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Icon, useToast, type IconName } from '@/components/ui';
import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SettingsStackParamList } from '@/navigation/types';

/* Only the routes reachable directly from this list — i.e. the ones with
 * no required params. `AccountFieldForm` needs a `field` and is reached
 * only from inside `AccountScreen`, never from here. */
type SettingsHomeRoute = 'Account' | 'Appearance' | 'UsageCredits' | 'Analytics';

interface Row {
  route: SettingsHomeRoute;
  label: string;
  sublabel: string;
  icon: IconName;
}

const ROWS: Row[] = [
  { route: 'Account', label: 'Account', sublabel: 'Profile, password, two-factor', icon: 'person-outline' },
  { route: 'Appearance', label: 'Appearance', sublabel: 'Light, dark or system, density, text size', icon: 'palette' },
  { route: 'UsageCredits', label: 'Usage and credits', sublabel: 'Your wallet, cap and this period’s spend', icon: 'account-balance-wallet' },
  { route: 'Analytics', label: 'Analytics', sublabel: 'Where consumption went over the last 7, 30 or 90 days', icon: 'insights' },
];

interface LegalRow {
  key: string;
  label: string;
  icon: IconName;
  /** Left blank until the real links are supplied — a tap shows a toast
   * instead of opening anything until these are filled in. */
  url: string;
}

const LEGAL_ROWS: LegalRow[] = [
  { key: 'terms', label: 'Terms and Conditions', icon: 'gavel', url: '' },
  { key: 'privacy', label: 'Privacy Policy', icon: 'privacy-tip', url: '' },
];

export function SettingsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const session = useAppSelector((s) => s.auth.session);
  const toast = useToast();

  const handleLegalRowPress = (row: LegalRow) => {
    if (!row.url) {
      toast.show(`${row.label} link is coming soon.`, { tone: 'neutral' });
      return;
    }
    Linking.openURL(row.url).catch(() => toast.show(`Could not open ${row.label}.`, { tone: 'error' }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Settings"
        mode="tab"
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onBellPress={() => navigation.getParent()?.getParent()?.navigate('Notifications' as never)}
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        {session && (
          <View style={[styles.userCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
            <View style={[styles.userAvatar, { backgroundColor: theme.colors.accent, borderRadius: theme.radii.full }]}>
              <Text style={styles.userInitials}>
                {(session.name || session.email).slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>
                {session.name || session.email.split('@')[0]}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
                {session.email}
              </Text>
              {session.role && (
                <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
                  {session.role.name}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
          {ROWS.map((row, i) => (
            <TouchableOpacity
              key={row.route}
              onPress={() => navigation.navigate(row.route)}
              style={[
                styles.row,
                i < ROWS.length - 1 && { borderBottomWidth: theme.borders.hairline, borderBottomColor: theme.colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={row.label}
            >
              <View style={[styles.rowIcon, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
                <Icon name={row.icon} size={20} color={theme.colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.md }}>
                  {row.label}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 1 }}>
                  {row.sublabel}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
          {LEGAL_ROWS.map((row, i) => (
            <TouchableOpacity
              key={row.key}
              onPress={() => handleLegalRowPress(row)}
              style={[
                styles.row,
                i < LEGAL_ROWS.length - 1 && { borderBottomWidth: theme.borders.hairline, borderBottomColor: theme.colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={row.label}
            >
              <View style={[styles.rowIcon, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
                <Icon name={row.icon} size={20} color={theme.colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.md }}>
                  {row.label}
                </Text>
              </View>
              <Icon name="open-in-new" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, gap: 12 },
  userAvatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  userInitials: { fontFamily: 'Syne_700Bold', fontSize: 16, color: '#FFFFFF' },
  section: { borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 60, gap: 12 },
  rowIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
