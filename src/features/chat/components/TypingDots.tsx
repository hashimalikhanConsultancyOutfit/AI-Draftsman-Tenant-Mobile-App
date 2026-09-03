import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';
import { DRAFTING_LABEL } from '../chatRules';

interface TypingDotsProps {
  color?: string;
  /** Set false to render just the three dots with no label — used inline
   * beside a typing-indicator name rather than as a full row. */
  showLabel?: boolean;
}

/**
 * Three dots pulsing in a staggered loop, ported from the old app's
 * `AiStructuredPending` treatment. Used for: another device's in-flight
 * turn (we only get `message:complete`, never its deltas), and as the
 * inline "someone is typing" indicator.
 */
export function TypingDots({ color, showLabel = true }: TypingDotsProps) {
  const { theme } = useAppTheme();
  const dotColor = color ?? theme.colors.accent;
  const values = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;

  useEffect(() => {
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(value, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.dots}>
        {values.map((value, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: dotColor, opacity: value }]}
          />
        ))}
      </View>
      {showLabel && (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontFamily: theme.fontFamilies.body.regular,
            fontSize: theme.fontSizes.sm,
          }}
        >
          {DRAFTING_LABEL}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
