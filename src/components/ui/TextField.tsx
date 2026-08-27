import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

import { Icon, type IconName } from './Icon';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  rightIconAccessibilityLabel?: string;
}

/** Ported from the reference app's AppTextInput, retitled TextField to avoid
 * shadowing React Native's own TextInput import at call sites. */
export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    { label, error, hint, leftIcon, rightIcon, onRightIconPress, rightIconAccessibilityLabel, style, ...rest },
    ref,
  ) => {
    const { theme } = useAppTheme();

    return (
      <View style={styles.wrapper}>
        {label && (
          <Text
            style={[
              styles.label,
              { color: theme.colors.text, fontSize: theme.fontSizes.sm, fontFamily: theme.fontFamilies.body.medium },
            ]}
          >
            {label}
          </Text>
        )}
        <View
          style={[
            styles.inputRow,
            {
              borderColor: error ? theme.colors.error : theme.colors.border,
              borderWidth: theme.borders.interactive,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.surface,
              minHeight: theme.controlHeights.md,
            },
          ]}
        >
          {leftIcon && (
            <View style={[styles.iconSlot, { paddingLeft: theme.space('md') }]}>
              <Icon name={leftIcon} size={19} color={theme.colors.textMuted} />
            </View>
          )}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              {
                color: theme.colors.text,
                fontSize: theme.fontSizes.md,
                fontFamily: theme.fontFamilies.body.regular,
                paddingLeft: leftIcon ? theme.space('sm') : theme.space('md'),
                paddingRight: rightIcon ? theme.space('sm') : theme.space('md'),
              },
              style,
            ]}
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel={label}
            {...rest}
          />
          {rightIcon && (
            <TouchableOpacity
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              style={[styles.iconSlot, { paddingRight: theme.space('md') }]}
              accessibilityRole={onRightIconPress ? 'button' : undefined}
              accessibilityLabel={rightIconAccessibilityLabel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name={rightIcon} size={19} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {(error || hint) && (
          <Text
            style={[
              styles.helper,
              {
                color: error ? theme.colors.error : theme.colors.textMuted,
                fontSize: theme.fontSizes.xs,
                fontFamily: theme.fontFamilies.body.regular,
              },
            ]}
          >
            {error ?? hint}
          </Text>
        )}
      </View>
    );
  },
);

TextField.displayName = 'TextField';

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  label: { marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
  iconSlot: { justifyContent: 'center', alignItems: 'center' },
  helper: { marginTop: 4 },
});
