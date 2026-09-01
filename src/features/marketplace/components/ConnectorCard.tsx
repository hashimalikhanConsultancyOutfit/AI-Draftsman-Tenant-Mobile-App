import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { AUTH_TYPE_LABEL, isBlocked, isInstallExpired } from '../marketplaceRules';
import type { Connector, ConnectorInstall } from '../marketplace.types';
import { ConnectorLogo } from './ConnectorLogo';

interface ConnectorCardProps {
  connector: Connector;
  install?: ConnectorInstall | null;
  onPress: () => void;
}

/** Catalogue tile. Blocked = tinted background + dashed border; connected =
 * a coloured rail down the left edge (green normally, orange if the
 * connection has expired) — deliberately not opacity, which fails contrast
 * on the muted text underneath. */
export function ConnectorCard({ connector, install, onPress }: ConnectorCardProps) {
  const { theme } = useAppTheme();
  const blocked = isBlocked(connector);
  const connected = Boolean(install);
  const expired = install ? isInstallExpired(install) : false;
  const railColor = connected ? (expired ? theme.colors.statusWarningFg : theme.colors.statusSuccessFg) : 'transparent';

  return (
    <TouchableOpacity
      onPress={blocked ? undefined : onPress}
      activeOpacity={blocked ? 1 : 0.75}
      style={[
        styles.card,
        {
          backgroundColor: blocked ? theme.colors.statusNeutralBg : theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.xl,
          borderStyle: blocked ? 'dashed' : 'solid',
          borderLeftWidth: connected ? 3 : StyleSheet.hairlineWidth,
          borderLeftColor: connected ? railColor : theme.colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${connector.name}`}
    >
      <View style={styles.top}>
        <ConnectorLogo name={connector.name} logo={connector.logo} size={38} dimmed={blocked} />
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {connector.name}
          </Text>
          {connector.description && (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={2}>
              {connector.description}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.metaRow}>
        {connected && (
          <View style={[styles.chip, { backgroundColor: expired ? theme.colors.statusWarningBg : theme.colors.statusSuccessBg }]}>
            <Text style={{ color: expired ? theme.colors.statusWarningFg : theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
              {expired ? 'Connection expired' : 'Connected'}
            </Text>
          </View>
        )}
        {blocked && (
          <View style={[styles.chip, { backgroundColor: theme.colors.statusNeutralBg }]}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>Not available yet</Text>
          </View>
        )}
        {connector.authType && (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{AUTH_TYPE_LABEL[connector.authType]}</Text>
        )}
        {connector.category[0] && (
          <>
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.xs }}>·</Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
              {connector.category[0]}
            </Text>
          </>
        )}
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
