import { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ChatCitation } from '../chat.types';

interface CitationListProps {
  citations: ChatCitation[];
  /** True inside a user bubble (accent background) — flips text tones. */
  dark: boolean;
}

/**
 * One citation renders as a plain caption; two or more collapse behind a
 * "Sources · {n}" toggle — mirrors the web exactly (`CitationList.tsx`).
 */
export function CitationList({ citations, dark }: CitationListProps) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const tone = dark ? theme.colors.textOnAccent : theme.colors.textMuted;

  if (citations.length === 1) {
    const c = citations[0];
    if (!c) return null;
    return (
      <Text style={[styles.caption, { color: tone }]}>
        Cited: {c.displayLabel}
        {c.locator ? `, ${c.locator}` : ''}
        {c.locatorPage !== null ? `, p.${c.locatorPage}` : ''}
      </Text>
    );
  }

  return (
    <View>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={[styles.caption, { color: tone, fontFamily: theme.fontFamilies.body.semibold }]}>
          Sources · {citations.length}
        </Text>
        <Icon name={expanded ? 'keyboard-arrow-down' : 'chevron-right'} size={16} color={tone} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.list}>
          {citations.map((c) => (
            <TouchableOpacity
              key={c.id}
              disabled={!c.sourceUrl}
              onPress={() => c.sourceUrl && Linking.openURL(c.sourceUrl)}
              style={styles.item}
            >
              <Text style={[styles.caption, { color: tone, textDecorationLine: c.sourceUrl ? 'underline' : 'none' }]}>
                {c.displayLabel}
                {c.locator ? `, ${c.locator}` : ''}
                {c.locatorPage !== null ? `, p.${c.locatorPage}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 12 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  list: { marginTop: 4, gap: 4 },
  item: { paddingVertical: 2 },
});
