import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { formatDate, isInstallExpired } from '../marketplaceRules';
import type { ConnectorInstall } from '../marketplace.types';
import { ConnectorLogo } from './ConnectorLogo';

interface ConnectedCardProps {
  install: ConnectorInstall;
  onPress: () => void;
}

/** Connected-view tile. Renders an INSTALL, not a connector — no
 * description/category/authType fields exist on `ConnectorInstall`, so this
 * shows the account it was authorised as instead. Deliberately not the same
 * component as `ConnectorCard`. */
export function ConnectedCard({ install, onPress }: ConnectedCardProps) {
  const { theme } = useAppTheme();
  const expired = isInstallExpired(install);
  const account = install.account;
  const accountLabel = account?.login ? `@${account.login}` : (account?.name ?? account?.email ?? install.provider ?? '—');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.xl,
          borderLeftWidth: 3,
          borderLeftColor: expired ? theme.colors.statusWarningFg : theme.colors.statusSuccessFg,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${install.connectorName}`}
    >
      <View style={styles.top}>
        <ConnectorLogo name={install.connectorName} logo={install.connectorLogo} size={38} />
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {install.connectorName}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
            {accountLabel}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.chip, { backgroundColor: expired ? theme.colors.statusWarningBg : theme.colors.statusSuccessBg }]}>
          <Text style={{ color: expired ? theme.colors.statusWarningFg : theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
            {expired ? 'Connection expired' : 'Connected'}
          </Text>
        </View>
        {install.customerId && (
          <View style={[styles.chip, { backgroundColor: theme.colors.statusInfoBg }]}>
            <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>Customer-scoped</Text>
          </View>
        )}
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {install.scopes.length} scope{install.scopes.length === 1 ? '' : 's'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginLeft: 'auto' }}>
          Connected {formatDate(install.connectedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  identity: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
