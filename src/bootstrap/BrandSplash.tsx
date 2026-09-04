import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * The custom animated JS splash shown between the native launch frame
 * hiding and the app being interactive — the "better splash screen"
 * explicitly requested. Purely presentational: BootstrapGate (below) owns
 * the timing of when this mounts/unmounts and drives fadeOut via the
 * `visible` prop.
 *
 * Design: the wordmark scales in with a soft overshoot, then a thin
 * accent-coloured progress hairline sweeps left-to-right on a loop while
 * fonts + the session bootstrap are still in flight. No spinner — a
 * premium app's splash reads as an entrance, not a loading state.
 */
export function BrandSplash({ visible }: { visible: boolean }) {
  const { theme } = useAppTheme();

  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 140,
      mass: 0.9,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animated refs are stable
  }, []);

  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.container, { backgroundColor: theme.colors.background, opacity }]}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <BrandLogo width={180} style={styles.logo} />
      </Animated.View>

      <View style={[styles.trackWrapper, { bottom: 64 }]}>
        <View style={[styles.track, { backgroundColor: theme.colors.border, borderRadius: theme.radii.full }]}>
          <Animated.View
            style={[
              styles.trackFill,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radii.full,
                transform: [
                  {
                    translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-96, 96] }),
                  },
                ],
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: {
    marginBottom: 16,
  },
  trackWrapper: { position: 'absolute', width: 96 },
  track: { width: 96, height: 3, overflow: 'hidden' },
  trackFill: { width: 40, height: 3 },
});
