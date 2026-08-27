import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Ported from the reference app's AppButton with two upgrades: an optional
 * leading/trailing icon (needed for "Open Authenticator" and deeplink CTAs),
 * and reading every visual constant from the new theme token set rather
 * than hardcoded literals.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const { theme } = useAppTheme();

  const bg: Record<Variant, string> = {
    primary: theme.colors.accent,
    secondary: theme.colors.secondary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: theme.colors.error,
  };

  const textColor: Record<Variant, string> = {
    primary: theme.colors.textOnAccent,
    secondary: theme.colors.textOnAccent,
    outline: theme.colors.accent,
    ghost: theme.colors.text,
    danger: theme.colors.textOnAccent,
  };

  const paddingV: Record<Size, number> = { sm: theme.space('sm'), md: theme.space('md'), lg: theme.space('lg') };
  const paddingH: Record<Size, number> = { sm: theme.space('md'), md: theme.space('xl'), lg: theme.space('2xl') };
  const fontSize: Record<Size, number> = { sm: theme.fontSizes.sm, md: theme.fontSizes.md, lg: theme.fontSizes.lg };
  const iconSize: Record<Size, number> = { sm: 16, md: 18, lg: 20 };

  const color = textColor[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: bg[variant],
          paddingVertical: paddingV[size],
          paddingHorizontal: paddingH[size],
          borderRadius: theme.radii.lg,
          borderWidth: variant === 'outline' ? theme.borders.interactive : 0,
          borderColor: variant === 'outline' ? theme.colors.accent : undefined,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          minHeight: theme.controlHeights[size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'],
          gap: theme.space('sm'),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && <Icon name={icon} size={iconSize[size]} color={color} />}
          <Text
            style={[
              styles.label,
              { color, fontSize: fontSize[size], fontFamily: theme.fontFamilies.body.semibold },
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && <Icon name={icon} size={iconSize[size]} color={color} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    letterSpacing: 0.2,
  },
});
