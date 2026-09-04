/**
 * The auto-reply draft notice. Ported from web's `TicketDrawer.tsx`
 * `DraftNotice` (confirmed against that source 2026-09-04): PENDING
 * shows a fixed "being written" message, HELD ticks a countdown off the
 * same 15-second clock web uses. Stop needs no confirmation — see
 * `supportApi.ts`'s doc comment on why cancel is deliberately
 * `support.view`-gated rather than a write grant.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportDraft } from '../support.types';
import { draftLead, draftPreview, draftRemainingMs, DRAFT_TICK_MS } from '../supportRules';

interface DraftBannerProps {
  draft: SupportDraft;
  isBusy: boolean;
  onStop: () => void;
}

export function DraftBanner({ draft, isBusy, onStop }: DraftBannerProps) {
  const { theme } = useAppTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (draft.state !== 'HELD') return;
    const timer = setInterval(() => setNow(Date.now()), DRAFT_TICK_MS);
    return () => clearInterval(timer);
  }, [draft.state]);

  const lead = draft.state === 'PENDING' ? 'An automated reply is being written.' : draftLead(draftRemainingMs(draft.sendAfter, now));
  const body = draft.state === 'PENDING' ? 'Nothing has been sent. It will be held before it goes out, so there is time to read it first.' : draftPreview(draft.body);

  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.lg }]}>
      <Icon name="hourglass-empty" size={16} color={theme.colors.statusInfoFg} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{lead}</Text>
        <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, lineHeight: 17 }}>{body}</Text>
        <Button label="Stop" size="sm" variant="outline" loading={isBusy} onPress={onStop} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'flex-start' },
});
