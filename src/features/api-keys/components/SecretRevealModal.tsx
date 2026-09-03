import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { formatDeadline, maskPrefix } from '../apiKeysRules';

export interface RevealedSecret {
  keyName: string;
  secret: string;
  /** Present only when this reveal followed a rotation, not a create. */
  previousValidUntil?: string | null;
  previousPrefix?: string | null;
  newPrefix?: string | null;
}

interface SecretRevealModalProps {
  secret: RevealedSecret | null;
  onDismiss: () => void;
}

/**
 * The one screen a key's secret ever appears on. Ported from web's
 * `SecretDialog.tsx` (confirmed against that source 2026-09-03) — its own
 * header comment there explains why this is not a generic modal: "a
 * generic reusable dialog is exactly the thing that should not be reusable
 * by accident" for a live credential.
 *
 * The secret is a prop and lives nowhere else — not in the RTK Query
 * cache, not in storage, not in a ref outside this tree. The moment the
 * parent drops it (on dismiss), it is gone; the API returns it once and
 * there is no endpoint that returns it again.
 *
 * DISMISSAL — deliberately matches web, not this app's other modals:
 * `onRequestClose` (the Android hardware back button) is a no-op, and there
 * is no backdrop press handler at all, so neither can close it — "a stray
 * click destroys a credential that cannot be recovered" in the web
 * original. There is still no hard "I've saved it" GATE though: both
 * footer buttons dismiss unconditionally. The label swap to "Done" after a
 * successful copy is a nudge, not an enforcement — copying is never
 * actually required to leave this screen, exactly as on web.
 */
export function SecretRevealModal({ secret, onDismiss }: SecretRevealModalProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    if (!secret) return;
    try {
      await Clipboard.setStringAsync(secret.secret);
      setHasCopied(true);
      toast.show('Secret copied to the clipboard.', { tone: 'success' });
    } catch {
      toast.show('Could not reach the clipboard. Select the key and copy it manually.', { tone: 'warning' });
    }
  };

  const handleDismiss = () => {
    setHasCopied(false);
    onDismiss();
  };

  if (!secret) return null;

  const isRotation = Boolean(secret.previousValidUntil);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.xl, paddingBottom: insets.bottom + 16 }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>
              {isRotation ? 'New secret for ' : 'Copy your secret for '}
              {secret.keyName}
            </Text>

            <View style={[styles.banner, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.md }]}>
              <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
                This is the only time this secret will be shown. Nothing stores it and there is no way to see it again — if it is lost, the key has to be rotated.
              </Text>
            </View>

            <View style={[styles.secretRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md, backgroundColor: theme.colors.background }]}>
              <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.sm, flex: 1 }}>
                {secret.secret}
              </Text>
              <Button label="" accessibilityLabel="Copy secret to clipboard" icon={hasCopied ? 'check' : 'content-copy'} size="sm" variant="ghost" onPress={handleCopy} />
            </View>

            {isRotation && secret.previousValidUntil ? (
              <View style={[styles.banner, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.md, gap: 8 }]}>
                <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
                  The previous secret keeps working until <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>{formatDeadline(secret.previousValidUntil)}</Text>. Deploy this one before
                  then — after that, callers still using the old secret start failing. Revoking the key closes the window immediately.
                </Text>
                {secret.previousPrefix && secret.newPrefix ? (
                  <>
                    <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs }}>
                      Replacing {maskPrefix(secret.previousPrefix)} with {maskPrefix(secret.newPrefix)}
                    </Text>
                    <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
                      A "Rotation in progress" banner appears at the top of the API keys screen until the window closes — the live countdown is behind it, so you do not need this screen again.
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button label="Copy" variant="outline" onPress={handleCopy} style={styles.footerButton} />
            <Button label={hasCopied ? 'Done' : 'I have copied it'} onPress={handleDismiss} style={styles.footerButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%' },
  content: { padding: 20, gap: 14 },
  banner: { padding: 12 },
  secretRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 4 },
  footerButton: { flex: 1 },
});
