import type { SerializedError } from '@reduxjs/toolkit';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, useToast, type IconName } from '@/components/ui';
import { useGetAgentsQuery } from '@/features/company-agents/companyAgentsApi';
import { CLONE_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

import type { CustomerAgentsStackParamList } from '@/navigation/types';
import { CLONE_STATE_TONE, buildCloneDeleteWarning, buildCloneDetailRows, buildRecloneWarning } from './cloneRules';
import { useDeleteCloneMutation, useGetAllClonesQuery, usePinCloneMutation, useRecloneCloneMutation } from './customerAgentsApi';

type Nav = NativeStackNavigationProp<CustomerAgentsStackParamList>;
type Rt = RouteProp<CustomerAgentsStackParamList, 'CloneDetail'>;

const FIELD_ICONS: Record<string, IconName> = {
  prompt: 'notes',
  model: 'smart-toy',
  tools: 'build',
  cust: 'person-outline',
  parent: 'account-tree',
  ver: 'history',
  spend: 'payments',
};

const STATE_LABEL: Record<string, string> = { 'in sync': 'In sync', diverged: 'Diverged', pinned: 'Pinned' };

export function CloneDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canManage = usePermission(CLONE_PERMISSIONS.MANAGE);
  const canReclone = usePermission(CLONE_PERMISSIONS.RECLONE);
  const canDelete = usePermission(CLONE_PERMISSIONS.DELETE);
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const { data: clones, isLoading, error, refetch } = useGetAllClonesQuery();
  const { data: agents } = useGetAgentsQuery();
  const clone = clones?.find((c) => c.id === params.id) ?? null;
  const master = agents?.find((a) => a.name === clone?.parent) ?? null;

  const [pinClone, { isLoading: isPinning }] = usePinCloneMutation();
  const [recloneClone, { isLoading: isRecloning }] = useRecloneCloneMutation();
  const [deleteClone, { isLoading: isDeleting }] = useDeleteCloneMutation();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Clone" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !clone) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Clone" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={error ? 'Could not load this clone.' : 'This clone no longer exists.'} onRetry={error ? refetch : undefined} />
      </View>
    );
  }

  const rows = buildCloneDetailRows(clone, master, canViewSpend);
  const tone = CLONE_STATE_TONE[clone.state];
  const toneColor = tone === 'success' ? theme.colors.statusSuccessFg : tone === 'warning' ? theme.colors.statusWarningFg : theme.colors.statusInfoFg;
  const toneBg = tone === 'success' ? theme.colors.statusSuccessBg : tone === 'warning' ? theme.colors.statusWarningBg : theme.colors.statusInfoBg;

  const handleCopyPrompt = async () => {
    await Clipboard.setStringAsync(clone.prompt ?? master?.prompt ?? '');
    toast.show('Prompt copied to clipboard', { tone: 'success' });
  };

  const handleTogglePin = async () => {
    if (!canManage) {
      toast.show('You do not have permission to pin or unpin clones.', { tone: 'warning' });
      return;
    }
    try {
      const next = !clone.pinned;
      await pinClone({ id: clone.id, pinned: next }).unwrap();
      toast.show(
        next
          ? `${clone.cust} pinned — pushes will skip this clone unless locked fields are forced on.`
          : `${clone.cust} unpinned — it will take the next push.`,
        { tone: 'success' },
      );
    } catch (err) {
      toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not change the pin.'), { tone: 'error' });
    }
  };

  const handleReclone = () => {
    if (!canReclone) {
      toast.show('You do not have permission to re-clone.', { tone: 'warning' });
      return;
    }
    Alert.alert('Re-clone from master?', buildRecloneWarning(clone.cust, clone.parent, master?.ver ?? clone.ver), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard and re-clone',
        style: 'destructive',
        onPress: async () => {
          try {
            const reset = await recloneClone({ id: clone.id }).unwrap();
            toast.show(`${clone.cust}'s copy of ${reset.parent} reset to v${String(reset.ver)}. Local changes discarded, divergence cleared.`, { tone: 'success' });
          } catch (err) {
            toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not re-clone.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!canDelete) {
      toast.show('You do not have permission to delete customer clones.', { tone: 'warning' });
      return;
    }
    Alert.alert('Delete clone?', buildCloneDeleteWarning(clone.cust, clone.parent), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClone(clone.id).unwrap();
            navigation.goBack();
          } catch (err) {
            toast.show(getErrorMessage(err as ApiQueryError | SerializedError, 'Could not delete that clone.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={clone.cust} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Card>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl }}>{clone.cust}</Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 2 }}>
                {master ? `Copy of ${clone.parent}` : `Copy of ${clone.parent} — master deleted`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {clone.pinned && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="push-pin" size={13} color={theme.colors.statusInfoFg} />
                  <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>Pinned</Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: toneBg, borderRadius: theme.radii.full }]}>
                <Text style={[styles.badgeText, { color: toneColor }]}>{STATE_LABEL[clone.state]}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            {canManage && (
              <Button label="Edit" icon="edit" variant="outline" size="sm" onPress={() => navigation.navigate('CloneEdit', { id: clone.id })} />
            )}
            {canManage && (
              <Button
                label={clone.pinned ? 'Unpin' : 'Pin'}
                icon="push-pin"
                variant="outline"
                size="sm"
                loading={isPinning}
                onPress={handleTogglePin}
              />
            )}
            {canReclone && (
              <Button label="Re-clone" icon="restart-alt" variant="outline" size="sm" loading={isRecloning} onPress={handleReclone} />
            )}
            {canDelete && (
              <Button label="Delete" icon="delete-outline" variant="outline" size="sm" loading={isDeleting} onPress={handleDelete} />
            )}
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>THIS COPY, BESIDE THE MASTER</Text>
        <Card elevated padded={false} style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
          {rows.map((row, index) => {
            const isMoney = row.moneyAmount !== undefined;
            return (
              <View key={row.id} style={styles.field}>
                <View style={[styles.fieldIconWrap, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
                  <Icon name={FIELD_ICONS[row.id] ?? 'info-outline'} size={15} color={theme.colors.accent} />
                </View>
                <View
                  style={[
                    styles.fieldContent,
                    index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                  ]}
                >
                  <View style={styles.fieldTop}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>{row.label.toUpperCase()}</Text>
                    <View style={styles.fieldTopRight}>
                      {row.id === 'prompt' && (
                        <Pressable
                          onPress={handleCopyPrompt}
                          hitSlop={8}
                          style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.5 : 1 }]}
                        >
                          <Icon name="content-copy" size={13} color={theme.colors.textMuted} />
                        </Pressable>
                      )}
                      {row.isDiverged && (
                        <View style={[styles.divergedPill, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.full }]}>
                          <Text style={[styles.divergedPillText, { color: theme.colors.statusWarningFg }]}>diverged</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {isMoney ? (
                    <Text style={[styles.fieldValue, { color: theme.colors.accent, fontFamily: theme.fontFamilies.mono.regular }]}>
                      {formatMoney(row.moneyAmount, 'GBP')}
                    </Text>
                  ) : (
                    <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{row.value}</Text>
                  )}

                  {row.masterValue !== undefined && (
                    <Text
                      style={[
                        styles.masterValue,
                        { color: row.isDiverged ? theme.colors.statusWarningFg : theme.colors.textMuted },
                      ]}
                      numberOfLines={3}
                    >
                      Master: {row.masterValue}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  sectionTitle: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, letterSpacing: 0.6, marginLeft: 2 },
  field: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  fieldIconWrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  fieldContent: { flex: 1, paddingVertical: 14 },
  fieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  fieldTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copyButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10.5, letterSpacing: 0.6 },
  fieldValue: { fontFamily: 'InstrumentSans_500Medium', fontSize: 14.5, lineHeight: 20 },
  masterValue: { fontFamily: 'InstrumentSans_400Regular', fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  divergedPill: { paddingHorizontal: 6, paddingVertical: 2 },
  divergedPillText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10 },
});
