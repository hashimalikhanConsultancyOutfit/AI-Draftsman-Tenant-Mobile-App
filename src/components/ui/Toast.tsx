import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { useAppTheme } from '@/theme/ThemeContext';

import { Icon, type IconName } from './Icon';

type ToastTone = 'neutral' | 'success' | 'error' | 'warning';

interface ToastOptions {
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_ICON: Record<ToastTone, IconName> = {
  neutral: 'info-outline',
  success: 'check-circle',
  error: 'error-outline',
  warning: 'warning-amber',
};

/**
 * A single-toast-at-a-time provider — simpler than a queue-with-stacking,
 * and matches how the web app's own toast surface behaves (one message
 * visible, the next replaces it). Uses RN's built-in Animated rather than
 * Reanimated: a toast is a simple fade/slide with no gesture interaction,
 * so the extra worklet machinery isn't earning its complexity here.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = ++idRef.current;
      setToast({ id, message, tone: options?.tone ?? 'neutral' });

      if (hideTimer.current) clearTimeout(hideTimer.current);

      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();

      hideTimer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setToast((current) => (current?.id === id ? null : current));
        });
      }, options?.durationMs ?? 3200);
    },
    [anim],
  );

  const toneColors: Record<ToastTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceRaised, fg: theme.colors.text },
    success: { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg },
    error: { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg },
    warning: { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg },
  };

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  const overlay = (
    <View style={styles.modalRoot} pointerEvents="box-none">
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.container,
            {
              top: insets.top + 8,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.pill,
              {
                backgroundColor: toneColors[toast.tone].bg,
                borderRadius: theme.radii.pill,
                ...theme.shadows.md,
              },
            ]}
          >
            <Icon name={TONE_ICON[toast.tone]} size={18} color={toneColors[toast.tone].fg} />
            <Text
              style={[
                styles.text,
                { color: toneColors[toast.tone].fg, fontSize: theme.fontSizes.sm, fontFamily: theme.fontFamilies.body.medium },
              ]}
              numberOfLines={2}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
       * A screen presented with `presentation: 'modal'` (native-stack)
       * opens its own native view controller / window above the rest of
       * the app, so a plain sibling view here would be visually stuck
       * BEHIND it — a toast fired while such a screen is open (e.g.
       * Clone Out, or the customer Register/Edit form) used to be
       * invisible.
       *
       * On iOS, RN's own `Modal` is not a reliable fix: it presents via
       * `RCTPresentedViewController`, whose notion of "currently
       * presented VC" does not consistently track a native-stack modal
       * presented through `react-native-screens`, so the toast's Modal
       * can still end up presented BELOW it. `FullWindowOverlay` (from
       * `react-native-screens`) instead renders straight under the OS
       * window, above every presented view controller unconditionally —
       * the library's own documented answer to exactly this problem.
       * It only exists on iOS (it warns and no-ops elsewhere), so
       * Android keeps the Modal-based approach, which does not have this
       * bug — Android's native-stack "modal" is a Fragment transaction
       * within the same Activity/Window that a Dialog-backed RN Modal
       * already draws above.
       */}
      {Platform.OS === 'ios' ? (
        <FullWindowOverlay>{overlay}</FullWindowOverlay>
      ) : (
        <Modal visible={Boolean(toast)} transparent animationType="none" statusBarTranslucent onRequestClose={() => undefined}>
          {overlay}
        </Modal>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  text: { flexShrink: 1 },
});
