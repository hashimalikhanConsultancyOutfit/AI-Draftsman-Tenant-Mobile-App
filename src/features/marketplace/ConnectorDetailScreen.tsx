import { useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { env } from '@/config/env';
import { CONNECTOR_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { MarketplaceStackParamList } from '@/navigation/types';
import { ConnectorLogo } from './components/ConnectorLogo';
import {
  AUTH_TYPE_LABEL,
  CONNECT_BLOCKED_EXPLANATION,
  DISCONNECT_TOOLTIP,
  NO_CONNECT_MESSAGE,
  buildToolGroups,
  connectMode,
  formatDate,
  installsBySlug,
  isInstallExpired,
  primaryActionLabel,
  toolGroupTitles,
  toolSourceCaption,
} from './marketplaceRules';
import { useGetConnectorInstallsQuery, useGetConnectorQuery, useRemoveConnectorInstallMutation, useStartConnectorOAuthMutation } from './marketplaceApi';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;
type Rt = RouteProp<MarketplaceStackParamList, 'ConnectorDetail'>;

/** Connector detail — auth block, connection block (if installed),
 * capabilities/granted-scopes, links, and the connect/disconnect actions.
 * Ported from web's `ConnectorDetailModal.tsx`, as a full push screen. */
export function ConnectorDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const toast = useToast();
  const { slug } = route.params;

  const { data: connector, isLoading, error, refetch } = useGetConnectorQuery(slug);
  const { data: installs, refetch: refetchInstalls } = useGetConnectorInstallsQuery();
  const install = installs ? installsBySlug(installs)[slug] : undefined;
  const canConnect = usePermission(CONNECTOR_PERMISSIONS.CONNECT);

  const [startOAuth, { isLoading: isStartingOAuth }] = useStartConnectorOAuthMutation();
  const [removeInstall, { isLoading: isDisconnecting }] = useRemoveConnectorInstallMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConnect() {
    if (!connector) return;
    if (!canConnect) {
      toast.show(NO_CONNECT_MESSAGE, { tone: 'warning' });
      return;
    }
    try {
      const { authorizeUrl } = await startOAuth({ slug: connector.slug, returnTo: `${env.webOrigin}/connectors` }).unwrap();
      // Hands off to the system browser — see ConnectorCatalogueSection's
      // header comment for why there is no in-app callback on mobile yet.
      const canOpen = await Linking.canOpenURL(authorizeUrl);
      if (canOpen) {
        await Linking.openURL(authorizeUrl);
        toast.show('Finish connecting in the browser, then come back here — your connection will appear once it completes.', { tone: 'neutral' });
      } else {
        toast.show('Could not open the browser to connect.', { tone: 'error' });
      }
    } catch (err) {
      toast.show(getErrorMessage(err as Parameters<typeof getErrorMessage>[0], 'Could not start connecting. Try again.'), { tone: 'error' });
    }
  }

  async function confirmDisconnect() {
    if (!install) return;
    setConfirmOpen(false);
    try {
      const result = await removeInstall(install.id).unwrap();
      toast.show(
        result.revoked
          ? `${install.connectorName} disconnected.`
          : `${install.connectorName} is disconnected here, but ${install.provider ?? 'the provider'} didn't confirm — the token may still be active. You can revoke it from their own settings.`,
        { tone: result.revoked ? 'success' : 'warning' },
      );
      void refetchInstalls();
    } catch (err) {
      toast.show(getErrorMessage(err as Parameters<typeof getErrorMessage>[0], 'Could not disconnect. Try again.'), { tone: 'error' });
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Connector" mode="stack" onBack={() => navigation.goBack()} />
        <Loader />
      </View>
    );
  }

  if (error || !connector) {
    const notFound = error && 'status' in error && error.status === 404;
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Connector" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState
          title={notFound ? 'Connector not found' : "Couldn't load this connector"}
          message={notFound ? 'This connector may have been removed or renamed.' : "The connectors service didn't respond. Try again."}
          onRetry={notFound ? undefined : refetch}
        />
      </View>
    );
  }

  const mode = connectMode(connector);
  const explanation = CONNECT_BLOCKED_EXPLANATION[mode];
  const groups = buildToolGroups(connector.scope, install);
  const titles = toolGroupTitles(groups.source);
  const caption = toolSourceCaption(groups.source);
  const expired = install ? isInstallExpired(install) : false;
  const hasLinks = Boolean(connector.meta?.website || connector.meta?.documentation || connector.meta?.support);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={connector.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.header}>
          <ConnectorLogo name={connector.name} logo={connector.logo} size={44} dimmed={connector.status === 'inactive'} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>{connector.name}</Text>
            {connector.meta?.developedBy && (
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>by {connector.meta.developedBy}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <View style={[styles.chip, { backgroundColor: connector.status === 'active' ? theme.colors.statusSuccessBg : theme.colors.statusNeutralBg }]}>
                <Text style={{ color: connector.status === 'active' ? theme.colors.statusSuccessFg : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
                  {connector.status === 'active' ? 'Available' : 'Not available yet'}
                </Text>
              </View>
              {install && (
                <View style={[styles.chip, { backgroundColor: expired ? theme.colors.statusWarningBg : theme.colors.statusSuccessBg }]}>
                  <Text style={{ color: expired ? theme.colors.statusWarningFg : theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
                    {expired ? 'Connection expired' : 'Connected'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {connector.description && (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20, marginTop: 12 }}>{connector.description}</Text>
        )}

        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginBottom: 6 }}>Authentication</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginBottom: explanation ? 8 : 0 }}>
            {connector.authType ? AUTH_TYPE_LABEL[connector.authType] : 'Unknown'}
          </Text>
          {explanation ? (
            <View style={[styles.notice, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.md }]}>
              <Icon name="info-outline" size={14} color={theme.colors.statusWarningFg} />
              <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17, flex: 1 }}>{explanation}</Text>
            </View>
          ) : mode === 'no-auth' ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
              No authentication required — there's nothing to connect. Your agents can use the capabilities below as they are.
            </Text>
          ) : null}
        </Card>

        {install && (
          <Card style={{ marginTop: 12 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginBottom: 6 }}>Connection</Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
              {install.account?.login ? `@${install.account.login}` : (install.account?.name ?? install.account?.email ?? install.provider ?? '—')}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>Connected {formatDate(install.connectedAt)}</Text>
            {install.customerId && (
              <View style={[styles.chip, { backgroundColor: theme.colors.statusInfoBg, alignSelf: 'flex-start', marginTop: 6 }]}>
                <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>Customer-scoped</Text>
              </View>
            )}
            {expired && (
              <View style={[styles.notice, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.md, marginTop: 8 }]}>
                <Icon name="warning" size={14} color={theme.colors.statusWarningFg} />
                <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17, flex: 1 }}>
                  Connection expired: this connection can't be renewed automatically. Reconnect to restore it.
                </Text>
              </View>
            )}
          </Card>
        )}

        <Card style={{ marginTop: 12 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{groups.source === 'granted-scopes' ? 'Granted access' : 'Capabilities'}</Text>
          {caption && (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 4 }}>{caption}</Text>
          )}
          {groups.read.length === 0 && groups.write.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 8 }}>This connector doesn't publish a tool list.</Text>
          ) : (
            <>
              {groups.read.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, marginBottom: 6 }}>{titles.read.toUpperCase()}</Text>
                  {groups.read.map((row) => (
                    <View key={row.id} style={{ marginBottom: 8 }}>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>{row.label}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 1 }}>{row.description}</Text>
                    </View>
                  ))}
                </View>
              )}
              {groups.write.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, marginBottom: 6 }}>{titles.write.toUpperCase()}</Text>
                  {groups.write.map((row) => (
                    <View key={row.id} style={{ marginBottom: 8 }}>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs }}>{row.label}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 1 }}>{row.description}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </Card>

        {hasLinks && (
          <Card style={{ marginTop: 12 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginBottom: 8 }}>Links</Text>
            {([
              ['Website', connector.meta?.website],
              ['Documentation', connector.meta?.documentation],
              ['Support', connector.meta?.support],
            ] as const).map(([label, url]) =>
              url ? (
                <TouchableOpacity key={label} onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
                  <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{label}</Text>
                  <Icon name="open-in-new" size={14} color={theme.colors.accent} />
                </TouchableOpacity>
              ) : null,
            )}
          </Card>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        {install && (
          <View style={{ flex: 1 }}>
            <Button label="Disconnect" variant="danger" icon="link-off" disabled={!canConnect} loading={isDisconnecting} onPress={() => (canConnect ? setConfirmOpen(true) : toast.show(DISCONNECT_TOOLTIP, { tone: 'neutral' }))} fullWidth />
          </View>
        )}
        {(mode === 'oauth' || mode === 'unknown-auth') && (
          <View style={{ flex: 1 }}>
            <Button label={primaryActionLabel(connector, install)} onPress={handleConnect} loading={isStartingOAuth} disabled={mode === 'unknown-auth'} fullWidth />
          </View>
        )}
      </View>

      <Modal visible={confirmOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setConfirmOpen(false)}>
        <TouchableOpacity style={[styles.sheetScrim, { backgroundColor: theme.colors.scrim }]} activeOpacity={1} onPress={() => setConfirmOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheetCard, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20 }}>Disconnect connector?</Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, paddingHorizontal: 20, marginTop: 8 }}>
              {connector.name} will be disconnected and its stored credentials deleted. Anything relying on it stops working until you reconnect.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="outline" onPress={() => setConfirmOpen(false)} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Disconnect" variant="danger" onPress={confirmDisconnect} fullWidth />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  sheetScrim: { flex: 1, justifyContent: 'flex-end' },
  sheetCard: { maxHeight: '80%', paddingTop: 10 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
});
