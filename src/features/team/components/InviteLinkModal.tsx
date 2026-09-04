import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { INVITE_LINK_COPY } from '../teamRules';

export interface InviteLinkInfo {
  email: string;
  acceptUrl: string;
  expiresAt: string;
  emailSent: boolean;
}

interface InviteLinkModalProps {
  info: InviteLinkInfo | null;
  onDismiss: () => void;
}

/**
 * Ported from web's `InviteLinkDialog.tsx` (confirmed against that source
 * 2026-09-04) — shown after every successful invite AND every resend, not
 * only a failed-email case, so the inviter always has a backup way to hand
 * the link over. Unlike `SecretRevealModal`, this is dismissible normally
 * (backdrop tap, Android back): an invite link can be re-minted on demand
 * (`GET /team/:id/invite-link`), so losing this screen loses nothing.
 */
export function InviteLinkModal({ info, onDismiss }: InviteLinkModalProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const handleCopy = async () => {
    if (!info) return;
    try {
      await Clipboard.setStringAsync(info.acceptUrl);
      toast.show('Link copied.', { tone: 'success' });
    } catch {
      toast.show('Could not reach the clipboard. Select the link and copy it manually.', { tone: 'warning' });
    }
  };

  if (!info) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.xl, paddingBottom: insets.bottom + 16 }]}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>Invite link</Text>

              <View style={[styles.banner, { backgroundColor: info.emailSent ? theme.colors.statusInfoBg : theme.colors.statusWarningBg, borderRadius: theme.radii.md }]}>
                <Text style={{ color: info.emailSent ? theme.colors.statusInfoFg : theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.xs, lineHeight: 18 }}>
                  {info.emailSent ? INVITE_LINK_COPY.emailed : INVITE_LINK_COPY.notSent}
                </Text>
              </View>

              <View style={[styles.linkRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md, backgroundColor: theme.colors.background }]}>
                <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: theme.fontSizes.xs, flex: 1 }}>
                  {info.acceptUrl}
                </Text>
              </View>

              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                Good for 7 days, until {new Date(info.expiresAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}.
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              <Button label="Copy link" variant="outline" icon="content-copy" onPress={handleCopy} style={styles.footerButton} />
              <Button label="Done" onPress={onDismiss} style={styles.footerButton} />
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%' },
  content: { padding: 20, gap: 14 },
  banner: { padding: 12 },
  linkRow: { borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 4 },
  footerButton: { flex: 1 },
});
