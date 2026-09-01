import { Platform, Switch as RNSwitch, StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * A themed, deliberately SMALLER toggle. React Native's stock `Switch`
 * renders at the OS's native (large) touch-target size, which reads as
 * oversized next to the app's otherwise compact, dense rows — this scales
 * it down ~22% and pins the on/off colours to the theme rather than the OS
 * default green, everywhere a toggle appears.
 */
export function Switch({ value, onValueChange, disabled, accessibilityLabel }: SwitchProps) {
  const { theme } = useAppTheme();

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: theme.colors.statusNeutralBg, true: theme.colors.accent }}
      thumbColor={Platform.OS === 'android' ? (value ? theme.colors.accent : theme.colors.surface) : undefined}
      ios_backgroundColor={theme.colors.statusNeutralBg}
      style={styles.scaled}
    />
  );
}

const styles = StyleSheet.create({
  scaled: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
  },
});
