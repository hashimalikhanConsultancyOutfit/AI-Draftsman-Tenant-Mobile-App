/**
 * PolicyViewScreen — a policy, read-only and in full. Ported from web's
 * `PolicyViewModal.tsx` (confirmed against that source 2026-09-03), whose
 * own header comment explains why this exists alongside the edit form
 * rather than being the same screen with disabled inputs: reading and
 * changing are different acts, and a disabled form both invites a click
 * that does nothing and makes viewing look like a privilege of the roles
 * that can edit. `key_policy.view` alone reaches this screen — no manage
 * grant required.
 *
 * An empty allow-list is never rendered as blank or a dash: for an
 * allow-list, empty is a RULE — "any address", "the scope decides" — and
 * showing nothing would leave the reader guessing whether it means
 * unrestricted or misconfigured.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader } from '@/components/ui';
import { KEY_POLICY_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents } from '@/utils/format';

import type { ApiKeysStackParamList } from '@/navigation/types';
import { useGetKeyPolicyQuery } from './apiKeysApi';
import { CADENCE_LABEL, SCOPE_LABEL } from './apiKeysRules';

type Nav = NativeStackNavigationProp<ApiKeysStackParamList>;
type Rt = RouteProp<ApiKeysStackParamList, 'PolicyView'>;

function Field({ label, children }: { label: string; children: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.3 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 3 }}>{children}</Text>
    </View>
  );
}

function IdentifierList({ values, emptyMeaning }: { values: string[]; emptyMeaning: string }) {
  const { theme } = useAppTheme();
  if (values.length === 0) {
    return <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 3, fontStyle: 'italic' }}>{emptyMeaning}</Text>;
  }
  return (
    <View style={styles.chipWrap}>
      {values.map((value) => (
        <View key={value} style={[styles.identifierChip, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.sm }]}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function PolicyViewScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const canManage = usePermission(KEY_POLICY_PERMISSIONS.MANAGE);
  const canViewSpend = usePermission(USAGE_PERMISSIONS.VIEW);

  const { data: policy, isLoading, error, refetch } = useGetKeyPolicyQuery(params.id);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Policy" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !policy) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Policy" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState title="Could not load this policy" message={getErrorMessage(error as never, 'Something went wrong.')} onRetry={refetch} />
      </View>
    );
  }

  const keyCount = policy._count.apiKeys;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={policy.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
          {keyCount === 0 ? 'No keys are using this policy.' : `${keyCount} key${keyCount === 1 ? '' : 's'} on this policy — editing it changes the limits for all of them.`}
        </Text>

        <Card style={styles.grid}>
          {policy.isDefault ? (
            <View style={[styles.chip, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.full, alignSelf: 'flex-start' }]}>
              <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>default</Text>
            </View>
          ) : null}

          <Field label="Scope">{SCOPE_LABEL[policy.scopeType]}</Field>
          {canViewSpend ? <Field label="Spend cap">{`${formatMoneyCents(policy.budgetMinor)} · resets ${CADENCE_LABEL[policy.budgetResetCadence].toLowerCase()}`}</Field> : null}
          <Field label="Requests per minute">{policy.requestsPerMinute.toLocaleString('en-GB')}</Field>
          <Field label="Tokens per minute">{policy.tokensPerMinute.toLocaleString('en-GB')}</Field>

          <View style={styles.field}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.3 }}>TRAINING</Text>
            <View style={[styles.chip, { backgroundColor: policy.allowTraining ? theme.colors.statusWarningBg : theme.colors.statusNeutralBg, borderRadius: theme.radii.full, alignSelf: 'flex-start', marginTop: 4 }]}>
              <Text style={{ color: policy.allowTraining ? theme.colors.statusWarningFg : theme.colors.statusNeutralFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>
                {policy.allowTraining ? 'Traffic may be used for training' : 'Traffic is not used for training'}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.grid}>
          <View style={styles.field}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.3 }}>IP ALLOW-LIST</Text>
            <IdentifierList values={policy.ipAllowlist} emptyMeaning="Any address. Keys on this policy are not restricted by source IP." />
          </View>
          <View style={styles.field}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.3 }}>ALLOWED MODELS</Text>
            <IdentifierList values={policy.allowedModelIds} emptyMeaning="No explicit list — the scope above decides which models this policy reaches." />
          </View>
          <View style={styles.field}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.3 }}>ALLOWED AGENTS</Text>
            <IdentifierList values={policy.allowedAgentIds} emptyMeaning="All agents." />
          </View>
        </Card>

        <Card style={styles.grid}>
          <Field label="Created">{new Date(policy.createdAt).toLocaleString('en-GB')}</Field>
          <Field label="Last changed">{new Date(policy.updatedAt).toLocaleString('en-GB')}</Field>
        </Card>

        {canManage ? <Button label="Edit policy" onPress={() => navigation.navigate('PolicyForm', { id: policy.id })} fullWidth /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  grid: { gap: 14 },
  field: {},
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  identifierChip: { paddingHorizontal: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 2 },
});
