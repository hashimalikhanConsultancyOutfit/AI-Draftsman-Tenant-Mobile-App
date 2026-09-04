import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { Icon } from './Icon';

/**
 * A simple boolean checkbox + label (e.g. login's "Remember me"). The
 * roles feature has its own tri-state `CheckboxRow` (checked / unchecked /
 * indeterminate, plus a caption) for permission grids — this is the
 * plain two-state version for everything else, promoted here per this
 * codebase's convention of lifting a component to `components/ui` once a
 * second feature needs it.
 */
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled = false }: CheckboxProps) {
  const { theme } = useAppTheme();
  const tint = disabled ? theme.colors.textMuted : checked ? theme.colors.accent : theme.colors.textMuted;

  return (
    <TouchableOpacity
      onPress={() => onChange(!checked)}
      disabled={disabled}
      style={[styles.row, disabled && styles.disabled]}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <Icon name={checked ? 'check-box' : 'check-box-outline-blank'} size={20} color={tint} />
      <Text
        style={{
          color: disabled ? theme.colors.textMuted : theme.colors.text,
          fontFamily: theme.fontFamilies.body.regular,
          fontSize: theme.fontSizes.sm,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.6 },
});
