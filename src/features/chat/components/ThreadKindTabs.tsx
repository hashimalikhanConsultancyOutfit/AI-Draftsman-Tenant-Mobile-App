import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { THREAD_KINDS, THREAD_KIND_LABEL, type ThreadKind } from '../teamChatRules';

interface ThreadKindTabsProps {
  value: ThreadKind;
  counts: Record<ThreadKind, number>;
  onChange: (kind: ThreadKind) => void;
}

/**
 * "Chat {n}" / "Teams {n}" — the web thread list's full-width underline
 * tabs: two equal halves on a hairline divider, the active one in bold ink
 * with a thick bar under it, the other muted. Deliberately not the app's
 * `StatusTabs` pills: these switch WHAT the list is, not filter within it,
 * and want the weight of a real tab bar.
 */
export function ThreadKindTabs({ value, counts, onChange }: ThreadKindTabsProps) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.bar, { borderBottomColor: theme.colors.border }]} accessibilityRole="tablist">
      {THREAD_KINDS.map((kind) => {
        const active = kind === value;
        return (
          <TouchableOpacity
            key={kind}
            onPress={() => onChange(kind)}
            activeOpacity={0.7}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${THREAD_KIND_LABEL[kind]}, ${counts[kind]} threads`}
          >
            <Text
              style={{
                color: active ? theme.colors.text : theme.colors.textMuted,
                fontFamily: active ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium,
                fontSize: theme.fontSizes.md,
              }}
            >
              {THREAD_KIND_LABEL[kind]} {counts[kind]}
            </Text>
            <View style={[styles.indicator, { backgroundColor: active ? theme.colors.text : 'transparent' }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 12, minHeight: 48 },
  indicator: { alignSelf: 'stretch', height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, marginTop: 10, marginBottom: -StyleSheet.hairlineWidth },
});
