import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoney } from '@/utils/format';

import { CUSTOMER_STATE_VARIANT, DEFAULT_STATE_VARIANT, quotaTone, toQuotaLabel, type StateVariant } from '../customersRules';
import type { CustomerRow } from '../customers.types';

interface CustomerCardProps {
  customer: CustomerRow;
  canViewBilling: boolean;
  onPress: () => void;
}

const STATE_LABEL: Record<CustomerRow['state'], string> = {
  active: 'Active',
  idle: 'Idle',
  'quota hit': 'Quota hit',
  suspended: 'Suspended',
};

function toneColors(theme: ReturnType<typeof useAppTheme>['theme'], tone: StateVariant) {
  if (tone === 'success') return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
  if (tone === 'danger') return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
  if (tone === 'warning') return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  if (tone === 'accent') return { bg: theme.colors.accent + '1A', fg: theme.colors.accent };
  return { bg: theme.colors.statusNeutralBg, fg: theme.colors.textMuted };
}

/** Registry list row — replaces web's `CustomerTable` row. Name, external
 * ID, agent count, a quota bar, state badge, and (billing-gated) price/
 * spend. Tapping opens the detail screen, where every write action lives
 * — the card itself is read-only, matching this app's established
 * list-card-opens-a-detail-screen convention (AgentCard, CloneCard). */
export function CustomerCard({ customer, canViewBilling, onPress }: CustomerCardProps) {
  const { theme } = useAppTheme();
  const stateTone = toneColors(theme, CUSTOMER_STATE_VARIANT[customer.state] ?? DEFAULT_STATE_VARIANT);
  const quotaKnown = customer.quota !== null;
  const quotaBarTone = quotaKnown ? toneColors(theme, quotaTone(customer.quota as number)) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${customer.name}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name="business" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
            {customer.externalId || '—'} · {customer.agents} agent{customer.agents === 1 ? '' : 's'}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.chip, { backgroundColor: stateTone.bg, borderRadius: theme.radii.full }]}>
          <Text style={{ color: stateTone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{STATE_LABEL[customer.state]}</Text>
        </View>

        <View style={styles.quotaBlock}>
          {quotaKnown && quotaBarTone ? (
            <>
              <View style={[styles.quotaTrack, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
                <View
                  style={[
                    styles.quotaFill,
                    { width: `${Math.min(100, Math.max(0, customer.quota as number))}%`, backgroundColor: quotaBarTone.fg, borderRadius: theme.radii.full },
                  ]}
                />
              </View>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{toQuotaLabel(customer.quota)}</Text>
            </>
          ) : (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>Quota {toQuotaLabel(customer.quota)}</Text>
          )}
        </View>

        {canViewBilling && (
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginLeft: 'auto' }} numberOfLines={1}>
            {customer.price === null ? '—' : `${formatMoney(customer.price, 'GBP')}/run`}
            {customer.spend !== null ? `  ·  ${formatMoney(customer.spend, 'GBP')}` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4 },
  quotaBlock: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  quotaTrack: { width: 46, height: 5, overflow: 'hidden' },
  quotaFill: { height: '100%' },
});
