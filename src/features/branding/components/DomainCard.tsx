/**
 * The custom-domain card's body — ported from web's `DomainRecords.tsx`
 * (confirmed against that source 2026-09-04), re-flowed from its 4-column
 * DNS grid into stacked record blocks: a hostname's TXT/CNAME value can
 * run to 60+ characters, which a phone-width table column would only
 * truncate — the same card-not-table adaptation every list in this app
 * already makes.
 *
 * Two actions, two catalogue rows, both disabled-with-a-caption rather
 * than hidden: this block only renders while somebody is mid-setup, so an
 * absent "Check now" would read as "nothing more to do" at the exact
 * moment there is something to do, and `domain.remove` is a separate
 * grant from `domain.manage` — the person who connected a hostname may
 * genuinely not be able to disconnect it.
 */

import * as Clipboard from 'expo-clipboard';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import type { Domain } from '../branding.types';
import { DNS_STATE_TAG, NOT_CONNECTED_MESSAGE, NO_REMOVE_MESSAGE, NO_ROUTING_RECORD_MESSAGE, NO_VERIFY_MESSAGE, hasRoutingRecord, isHalfDone, statusMessage } from '../brandingRules';

interface DomainCardProps {
  domain: Domain | null;
  isChecking: boolean;
  isRemoving: boolean;
  canVerify: boolean;
  canRemove: boolean;
  onCheckNow: () => void;
  onDisconnect: () => void;
}

function Chip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 11, fontFamily: 'InstrumentSans_600SemiBold' }}>{label}</Text>
    </View>
  );
}

export function DomainCard({ domain, isChecking, isRemoving, canVerify, canRemove, onCheckNow, onDisconnect }: DomainCardProps) {
  const { theme } = useAppTheme();
  const toast = useToast();

  const copyValue = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      toast.show('Copied.', { tone: 'success' });
    } catch {
      toast.show('Could not copy — select the value and copy it by hand.', { tone: 'warning' });
    }
  };

  if (!domain) {
    return <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{NOT_CONNECTED_MESSAGE}</Text>;
  }

  const tag = DNS_STATE_TAG[domain.dnsState];
  const tagColors = {
    warning: { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg },
    success: { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg },
    error: { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg },
  }[tag.tone];

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.headerRow}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md, flexShrink: 1 }} numberOfLines={1}>
          {domain.hostname}
        </Text>
        <Chip label={tag.label} bg={tagColors.bg} fg={tagColors.fg} />
        <Chip label={domain.tlsState === 'ACTIVE' ? 'TLS has served' : 'TLS not seen yet'} bg={theme.colors.statusNeutralBg} fg={theme.colors.statusNeutralFg} />
      </View>

      {domain.lastCheckedAt ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>Last checked {formatRelativeTime(domain.lastCheckedAt)}</Text>
      ) : null}

      {domain.records.length > 0 ? (
        <View style={{ gap: 8 }}>
          {domain.records.map((record) => (
            <Card key={`${record.type}:${record.name}:${record.value}`} style={styles.recordCard} padded>
              <View style={styles.recordHeaderRow}>
                <Chip label={record.type} bg={theme.colors.statusNeutralBg} fg={theme.colors.statusNeutralFg} />
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>
                  {record.name}
                </Text>
              </View>
              <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, marginTop: 4 }}>
                {record.value}
              </Text>
              <Button label="Copy" size="sm" variant="ghost" icon="content-copy" onPress={() => copyValue(record.value)} style={styles.copyButton} />
            </Card>
          ))}
        </View>
      ) : null}

      {!hasRoutingRecord(domain) ? (
        <Card style={[styles.noticeCard, { backgroundColor: theme.colors.statusInfoBg }]}>
          <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>{NO_ROUTING_RECORD_MESSAGE}</Text>
        </Card>
      ) : null}

      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
        {isHalfDone(domain) ? '✓ ' : ''}
        {statusMessage(domain)}
      </Text>

      <View style={styles.actionRow}>
        {domain.dnsState !== 'VERIFIED' ? <Button label={isChecking ? 'Checking…' : 'Check now'} size="sm" variant="outline" icon="sync" loading={isChecking} disabled={!canVerify} onPress={onCheckNow} style={styles.actionButton} /> : null}
        <Button label="Disconnect" size="sm" variant="danger" icon="link-off" loading={isRemoving} disabled={!canRemove} onPress={onDisconnect} style={styles.actionButton} />
      </View>
      {!canVerify && domain.dnsState !== 'VERIFIED' ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{NO_VERIFY_MESSAGE}</Text> : null}
      {!canRemove ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{NO_REMOVE_MESSAGE}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  recordCard: { gap: 2 },
  recordHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copyButton: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 0 },
  noticeCard: { gap: 4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { flexGrow: 1, flexBasis: '47%' },
});
