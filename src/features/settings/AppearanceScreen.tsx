import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Card, Icon } from '@/components/ui';
import type { DensityKey, FontScaleKey } from '@/theme/tokens';
import { useAppTheme, type ThemeMode } from '@/theme/ThemeContext';

interface OptionRowProps<T extends string> {
  options: { value: T; label: string; description: string }[];
  value: T;
  onChange: (value: T) => void;
}

function OptionList<T extends string>({ options, value, onChange }: OptionRowProps<T>) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: theme.space('sm') }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
            style={[
              styles.option,
              {
                borderRadius: theme.radii.lg,
                borderWidth: selected ? theme.borders.interactive : theme.borders.hairline,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                backgroundColor: selected ? theme.colors.accent + '14' : theme.colors.surface,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }}>
                {opt.label}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
                {opt.description}
              </Text>
            </View>
            {selected && <Icon name="check-circle" size={22} color={theme.colors.accent} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * The one settings screen that is real functionality this phase, not a
 * placeholder — ThemeProvider already exposes setMode/setDensity/
 * setFontSize (src/theme/ThemeContext.tsx), so this screen is wiring, not
 * new state.
 */
export function AppearanceScreen() {
  const { theme, personalization, setMode, setDensity, setFontSize } = useAppTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Appearance" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>THEME</Text>
          <Card>
            <OptionList<ThemeMode>
              value={personalization.mode}
              onChange={setMode}
              options={[
                { value: 'light', label: 'Light', description: 'Always use the light theme' },
                { value: 'dark', label: 'Dark', description: 'Always use the dark theme' },
                { value: 'system', label: 'System', description: 'Match your device setting' },
              ]}
            />
          </Card>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>DENSITY</Text>
          <Card>
            <OptionList<DensityKey>
              value={personalization.density}
              onChange={setDensity}
              options={[
                { value: 'compact', label: 'Compact', description: 'Tighter spacing, more on screen' },
                { value: 'comfortable', label: 'Comfortable', description: 'The default spacing' },
                { value: 'spacious', label: 'Spacious', description: 'More breathing room' },
              ]}
            />
          </Card>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>TEXT SIZE</Text>
          <Card>
            <OptionList<FontScaleKey>
              value={personalization.fontSize}
              onChange={setFontSize}
              options={[
                { value: 'small', label: 'Small', description: 'Smaller text throughout the app' },
                { value: 'medium', label: 'Medium', description: 'The default text size' },
                { value: 'large', label: 'Large', description: 'Larger text throughout the app' },
              ]}
            />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20 },
  sectionTitle: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, letterSpacing: 0.6, marginBottom: 8, marginLeft: 2 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 14 },
});
