/**
 * The module's bottom sheet — mobile's shape for web's `Dialog`s and
 * `ConfirmDialog`s (send confirmation, a response's review, the form
 * preview). Same scrim, handle and top radius as this app's other sheets
 * (`EscalateSheet`, `PickerField`); the body scrolls and the footer stays
 * pinned above the home indicator.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface SurveySheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Taller sheet for long content (preview, a response's answers). */
  tall?: boolean;
}

export function SurveySheet({ visible, title, onClose, children, footer, tall = false }: SurveySheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.scrim}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />
          <View
            style={[
              styles.sheet,
              tall && styles.tall,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: insets.bottom + 16,
                borderTopLeftRadius: theme.radii.sheetTop,
                borderTopRightRadius: theme.radii.sheetTop,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            <View style={styles.titleRow}>
              <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }} numberOfLines={2}>
                {title}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10, maxHeight: '85%' },
  tall: { height: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 10 },
  body: { paddingHorizontal: 20, gap: 12, paddingBottom: 12 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
});
