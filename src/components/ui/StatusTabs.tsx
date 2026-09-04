import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

interface Tab {
  label: string;
  value: string;
}

interface StatusTabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * A horizontally-scrolling pill row — the mobile shape for what web renders
 * as MUI tabs (API keys' status/scope/training filters; Team's role and
 * status filters). Built for API keys, promoted here once Team needed the
 * exact same control — a shared primitive alongside `PickerField` and
 * `MultiSelectField`, for a closed set of filter values shown all at once
 * rather than behind a picker sheet.
 */
export function StatusTabs({ tabs, value, onChange }: StatusTabsProps) {
  const { theme } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <TouchableOpacity
            key={tab.value || '__any__'}
            onPress={() => onChange(tab.value)}
            style={[
              styles.pill,
              {
                backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                borderColor: active ? theme.colors.accent : theme.colors.border,
                borderRadius: theme.radii.full,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={{
                color: active ? theme.colors.textOnAccent : theme.colors.text,
                fontFamily: theme.fontFamilies.body.semibold,
                fontSize: theme.fontSizes.xs,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth },
});
