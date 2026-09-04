/**
 * BrandingScreen — ported from web's `Branding.tsx` (confirmed against
 * that source 2026-09-04), trimmed to the two panels this app can
 * actually back with real data: the Brand card (`/branding`) and the
 * Custom domain card (`/domains`). See `branding.types.ts`'s module doc
 * for what web's route also shows — a white-label level, a sending
 * address, a status-page hostname, model aliases — and why none of it
 * has anywhere to write to from here.
 *
 * `branding.view` gates the whole screen, exactly as it gates both reads
 * on web's route: neither `domain` nor (on web) `model_alias` carries its
 * own view slug in the catalogue.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, Loader, useToast } from '@/components/ui';
import { BRANDING_PERMISSIONS, DOMAIN_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { BrandingStackParamList } from '@/navigation/types';
import { useGetBrandingQuery, useGetDomainsQuery, useRemoveDomainMutation, useVerifyDomainMutation } from './brandingApi';
import { DomainCard } from './components/DomainCard';
import {
  BRAND_CARD_TITLE,
  DISCONNECT_COPY,
  DISCONNECT_SUCCESS_TOAST,
  DOMAIN_CARD_TITLE,
  NO_MANAGE_BRAND_MESSAGE,
  NO_MANAGE_DOMAIN_MESSAGE,
  NO_VIEW_DESCRIPTION,
  PAGE_DESCRIPTION,
  POLL_INTERVAL_MS,
  POLL_MAX_TICKS,
  RATE_LIMITED_STATUS,
  VERIFIED_SUCCESS_TOAST,
  currentDomain,
} from './brandingRules';

type Nav = NativeStackNavigationProp<BrandingStackParamList>;

export function BrandingScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(BRANDING_PERMISSIONS.VIEW);
  const canManageBrand = usePermission(BRANDING_PERMISSIONS.MANAGE);
  const canManageDomain = usePermission(DOMAIN_PERMISSIONS.MANAGE);
  const canVerifyDomain = usePermission(DOMAIN_PERMISSIONS.VERIFY);
  const canRemoveDomain = usePermission(DOMAIN_PERMISSIONS.REMOVE);

  const brandingQuery = useGetBrandingQuery(undefined, { skip: !canView });
  const domainsQuery = useGetDomainsQuery(undefined, { skip: !canView });
  const [verifyDomain, { isLoading: isChecking }] = useVerifyDomainMutation();
  const [removeDomain, { isLoading: isRemoving }] = useRemoveDomainMutation();

  const domain = currentDomain(domainsQuery.data);

  /* Poll a PENDING domain every 30s, up to ~10 minutes — mirrors web's
   * `useCustomDomains`. Silent by construction: a 429 here is the
   * backend's own per-domain cooldown doing its job, and a check that
   * fails is not a rejection at all — it answers 200 with a
   * `failureReason` the card already renders. */
  const pendingId = domain?.dnsState === 'PENDING' ? domain.id : null;
  const ticksRef = useRef(0);
  useEffect(() => {
    ticksRef.current = 0;
    if (!pendingId) return;
    const timer = setInterval(() => {
      ticksRef.current += 1;
      if (ticksRef.current > POLL_MAX_TICKS) {
        clearInterval(timer);
        return;
      }
      void verifyDomain(pendingId)
        .unwrap()
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingId, verifyDomain]);

  const onRefresh = useCallback(() => {
    void brandingQuery.refetch();
    void domainsQuery.refetch();
  }, [brandingQuery, domainsQuery]);

  const handleEditBrand = useCallback(() => {
    if (!canManageBrand) {
      toast.show(NO_MANAGE_BRAND_MESSAGE, { tone: 'warning' });
      return;
    }
    navigation.navigate('BrandForm');
  }, [canManageBrand, navigation, toast]);

  const handleConnectDomain = useCallback(() => {
    if (!canManageDomain) {
      toast.show(NO_MANAGE_DOMAIN_MESSAGE, { tone: 'warning' });
      return;
    }
    navigation.navigate('DomainForm');
  }, [canManageDomain, navigation, toast]);

  const handleCheckNow = useCallback(async () => {
    if (!domain) return;
    try {
      const checked = await verifyDomain(domain.id).unwrap();
      if (checked.dnsState === 'VERIFIED') {
        toast.show(VERIFIED_SUCCESS_TOAST(checked.hostname), { tone: 'success' });
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === RATE_LIMITED_STATUS) {
        toast.show(getErrorMessage(err as never, 'Checked too recently — try again shortly.'), { tone: 'neutral' });
        return;
      }
      toast.show(getErrorMessage(err as never, 'Could not check that domain.'), { tone: 'error' });
    }
  }, [domain, toast, verifyDomain]);

  const handleDisconnect = useCallback(() => {
    if (!domain) return;
    Alert.alert(DISCONNECT_COPY.title, DISCONNECT_COPY.body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: DISCONNECT_COPY.confirmLabel,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeDomain(domain.id).unwrap();
            toast.show(DISCONNECT_SUCCESS_TOAST(domain.hostname), { tone: 'neutral' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not disconnect that domain.'), { tone: 'error' });
          }
        },
      },
    ]);
  }, [domain, removeDomain, toast]);

  const openHeader = () => (
    <AppHeader title="Branding & domain" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)} />
  );

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {openHeader()}
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title="You cannot view branding" description={NO_VIEW_DESCRIPTION} />
        </View>
      </View>
    );
  }

  if (brandingQuery.isLoading && !brandingQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {openHeader()}
        <Loader fullScreen />
      </View>
    );
  }

  const brand = brandingQuery.data ?? null;
  const isRefreshing = (brandingQuery.isFetching && !brandingQuery.isLoading) || (domainsQuery.isFetching && !domainsQuery.isLoading);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {openHeader()}
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{PAGE_DESCRIPTION}</Text>

        <Card style={styles.section}>
          <View style={styles.cardHeaderRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{BRAND_CARD_TITLE}</Text>
            <Button label="Edit brand" size="sm" variant="outline" icon="palette" disabled={!canManageBrand} onPress={handleEditBrand} />
          </View>
          {!canManageBrand ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{NO_MANAGE_BRAND_MESSAGE}</Text> : null}

          {brand ? (
            <View style={styles.brandPreviewRow}>
              <View style={[styles.swatch, { backgroundColor: brand.palette.primary, borderColor: theme.colors.border }]} />
              <View style={[styles.swatch, { backgroundColor: brand.palette.accent, borderColor: theme.colors.border }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{brand.typography}</Text>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{brand.powered ? 'Badge shown' : 'Badge hidden'}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <View style={styles.cardHeaderRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{DOMAIN_CARD_TITLE}</Text>
            {!domain ? <Button label="Connect" size="sm" variant="outline" icon="domain" disabled={!canManageDomain} onPress={handleConnectDomain} /> : null}
          </View>
          {!domain && !canManageDomain ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{NO_MANAGE_DOMAIN_MESSAGE}</Text> : null}
          <DomainCard domain={domain} isChecking={isChecking} isRemoving={isRemoving} canVerify={canVerifyDomain} canRemove={canRemoveDomain} onCheckNow={handleCheckNow} onDisconnect={handleDisconnect} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { gap: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brandPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  swatch: { width: 32, height: 32, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
});
