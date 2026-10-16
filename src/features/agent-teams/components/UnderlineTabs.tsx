import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

interface UnderlineTab<T extends string> {
  value: T;
  label: string;
  /** Shown as a small count pill beside the label. */
  count?: number;
}

interface UnderlineTabsProps<T extends string> {
  tabs: ReadonlyArray<UnderlineTab<T>>;
  value: T;
  onChange: (value: T) => void;
}

/**
 * Full-width underline tabs — the same shape as Chat's Chat / Teams switch:
 * equal segments on a hairline, the active one in ink with a thick bar.
 * For switching WHAT a screen shows, where pills (StatusTabs) read as a
 * filter.
 */
export function UnderlineTabs<T extends string>({ tabs, value, onChange }: UnderlineTabsProps<T>) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.bar, { borderBottomColor: theme.colors.border }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <TouchableOpacity
            key={tab.value}
            onPress={() => onChange(tab.value)}
            activeOpacity={0.7}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={styles.labelRow}>
              <Text
                style={{
                  color: active ? theme.colors.text : theme.colors.textMuted,
                  fontFamily: active ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium,
                  fontSize: theme.fontSizes.md,
                }}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined ? (
                <View style={[styles.count, { backgroundColor: active ? theme.colors.accent : theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
                  <Text style={{ color: active ? '#FFFFFF' : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{tab.count}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.indicator, { backgroundColor: active ? theme.colors.text : 'transparent' }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 },
  count: { minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  indicator: { height: 3, alignSelf: 'stretch', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
