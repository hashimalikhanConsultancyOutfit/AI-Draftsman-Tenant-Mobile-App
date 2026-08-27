import { useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
}

/** Ported from the reference app, unchanged in behaviour — six boxed digit
 * cells with auto-advance and backspace-to-previous. Used on the OTP verify
 * screen; the mono numeral font (Space Mono) is a deliberate design token,
 * not a leftover — OTP/money/ID digits all use it for legibility. */
export function OtpInput({ length = 6, value, onChange, autoFocus = true, editable = true }: OtpInputProps) {
  const { theme } = useAppTheme();
  const inputs = useRef<(TextInput | null)[]>([]);

  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  const handleChange = (text: string, index: number) => {
    const sanitized = text.replace(/[^0-9]/g, '').slice(-1);
    const next = chars.map((c, i) => (i === index ? sanitized : c));
    onChange(next.join(''));
    if (sanitized && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !chars[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const next = chars.map((c, i) => (i === index - 1 ? '' : c));
      onChange(next.join(''));
    }
  };

  return (
    <View style={styles.row}>
      {chars.map((char, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          value={char}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          selectTextOnFocus
          editable={editable}
          style={[
            styles.cell,
            {
              borderColor: char ? theme.colors.accent : theme.colors.border,
              borderWidth: theme.borders.interactive,
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.lg,
              fontSize: theme.fontSizes.xl,
              fontFamily: theme.fontFamilies.mono.regular,
              opacity: editable ? 1 : 0.6,
            },
          ]}
          accessibilityLabel={`Digit ${i + 1} of ${length}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  cell: {
    width: 48,
    height: 56,
    textAlign: 'center',
  },
});
