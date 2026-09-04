import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAppTheme } from '@/theme/ThemeContext';

interface AuthScreenLayoutProps {
  /** Small uppercase status label above the title (e.g. "Reset password"). Ignored when `logo` is set. */
  eyebrow?: string;
  /** Show the brand wordmark (the same one used on the splash screen) instead of the `eyebrow` text — used on the sign-in screen, which wants the brand mark rather than a status label. */
  logo?: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared chrome for every auth-stack screen: safe-area padded, keyboard
 * avoiding, and a consistent title block so Login/OTP/Enrolment/Forgot/Reset
 * read as one flow rather than five separately designed screens.
 */
export function AuthScreenLayout({ eyebrow, logo, title, subtitle, children, footer }: AuthScreenLayoutProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.space('3xl'), paddingBottom: insets.bottom + theme.space('xl') },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[{ marginBottom: theme.space('2xl') }, logo && styles.centeredHeader]}>
          {logo ? (
            <BrandLogo width={170} style={styles.logo} />
          ) : (
            eyebrow && (
              <Text
                style={[
                  styles.eyebrow,
                  { color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs },
                ]}
              >
                {eyebrow}
              </Text>
            )
          )}
          <Text
            style={[
              styles.title,
              logo && styles.centeredText,
              { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes['3xl'] },
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                logo && styles.centeredText,
                { color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.md },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>

        <View style={{ gap: theme.space('lg') }}>{children}</View>

        {footer && <View style={{ marginTop: theme.space('2xl') }}>{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  logo: { alignSelf: 'center', marginBottom: 12 },
  // Only applied when `logo` is set (the sign-in screen) — every other
  // auth-stack screen keeps its left-aligned eyebrow/title/subtitle.
  centeredHeader: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  title: { letterSpacing: 0.2 },
  subtitle: { marginTop: 8, lineHeight: 22 },
});
