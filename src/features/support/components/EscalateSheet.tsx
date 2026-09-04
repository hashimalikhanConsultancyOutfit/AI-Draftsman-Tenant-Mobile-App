/**
 * The escalate confirmation, as a bottom sheet — mobile's shape for
 * web's `ConfirmDialog` (`Support.tsx`, confirmed against that source
 * 2026-09-04): the exact privacy notice and reason-field copy, carried
 * over verbatim. A sheet rather than a new stack screen, since this is
 * the only place in the module that needs free text alongside a
 * confirm/cancel pair — `PickerField`'s own bottom-sheet is the
 * established shape for that in this app.
 */
import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { ESCALATE_PRIVACY_NOTE, ESCALATE_REASON_HINT, ESCALATE_REASON_MAX_LENGTH, ESCALATE_REASON_PLACEHOLDER } from '../supportRules';

interface EscalateSheetProps {
  visible: boolean;
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function EscalateSheet({ visible, isSubmitting, onConfirm, onClose }: EscalateSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, paddingHorizontal: 20, marginBottom: 12 }}>Escalate to AiDraftsman?</Text>

          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <View style={[styles.notice, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.md }]}>
              <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: 12, lineHeight: 17 }}>{ESCALATE_PRIVACY_NOTE}</Text>
            </View>

            <View>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 13, marginBottom: 6 }}>What is going wrong? (optional)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={ESCALATE_REASON_PLACEHOLDER}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
                maxLength={ESCALATE_REASON_MAX_LENGTH}
                style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, borderRadius: theme.radii.md }]}
              />
              <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 4 }}>{ESCALATE_REASON_HINT}</Text>
            </View>

            <Button label="Escalate" onPress={() => onConfirm(reason.trim())} loading={isSubmitting} fullWidth />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  notice: { padding: 12 },
  input: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top', fontSize: 14 },
});
