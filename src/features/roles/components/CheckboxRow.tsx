/**
 * A tri-state checkbox row: `checked` | `unchecked` | `indeterminate` (the
 * module header's "partial selection" state, web's MUI indeterminate box).
 * No shared `Checkbox` exists in `components/ui` yet — this is the first
 * screen that needs one, so it stays local here per this codebase's
 * promotion convention (promoted to `components/ui` once a second feature
 * needs the exact same thing, as `StatusTabs` and `MultiSelectField` were).
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

export type CheckboxState = 'checked' | 'unchecked' | 'indeterminate';

interface CheckboxRowProps {
  label: string;
  state: CheckboxState;
  onPress: () => void;
  disabled?: boolean;
  /** Shown as a caption under the label — mobile's stand-in for web's
   * hover-`title` attribute carrying the raw slug, since nothing here can
   * be hovered. */
  caption?: string;
  /** Bold weight + slightly larger — used for a module's own header row. */
  emphasis?: boolean;
}

export function CheckboxRow({ label, state, onPress, disabled = false, caption, emphasis = false }: CheckboxRowProps) {
  const { theme } = useAppTheme();
  const iconName = state === 'checked' ? 'check-box' : state === 'indeterminate' ? 'indeterminate-check-box' : 'check-box-outline-blank';
  const tint = disabled ? theme.colors.textMuted : state === 'unchecked' ? theme.colors.textMuted : theme.colors.accent;

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.row, disabled && styles.disabled]} activeOpacity={0.7}>
      <Icon name={iconName} size={emphasis ? 22 : 20} color={tint} />
      <View style={styles.textCol}>
        <Text
          style={{
            color: disabled ? theme.colors.textMuted : theme.colors.text,
            fontFamily: emphasis ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.regular,
            fontSize: emphasis ? theme.fontSizes.sm : theme.fontSizes.sm,
          }}
        >
          {label}
        </Text>
        {caption ? (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  disabled: { opacity: 0.6 },
  textCol: { flex: 1 },
});
