import { useRef } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

interface AttachSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickFiles: () => void;
  onPickPhotos: () => void;
  onPickVideos: () => void;
}

interface Option {
  key: string;
  icon: IconName;
  label: string;
  hint: string;
  onPress: () => void;
}

/**
 * The composer's attach action sheet — three entries, matching the web's
 * paperclip menu exactly. There is no camera entry and no voice-capture
 * entry: neither exists on web (see docs/chat-module-spec.md D-10/D-11),
 * so this is not a place where "mobile should have more options" applies —
 * it is a deliberate parity choice, not an oversight.
 */
export function AttachSheet({ visible, onClose, onPickFiles, onPickPhotos, onPickVideos }: AttachSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  /**
   * The action an option tap wants to run, deferred until the sheet has
   * actually finished closing.
   *
   * Calling `onClose()` (which flips `visible` to false) and the picker
   * action in the same tick raced iOS's own dismiss animation: presenting
   * `UIImagePickerController`/`UIDocumentPickerViewController` while the
   * sheet's `Modal` is still mid-dismissal is silently dropped by UIKit —
   * no error, the picker just never opens. `Modal`'s `onDismiss` (iOS only)
   * fires once that animation genuinely finishes, which is what this
   * defers to. Android's modal dismissal has no comparable race, so it
   * runs the action immediately.
   */
  const pendingAction = useRef<(() => void) | null>(null);

  const selectOption = (action: () => void) => {
    if (Platform.OS === 'ios') {
      pendingAction.current = action;
      onClose();
    } else {
      onClose();
      action();
    }
  };

  const options: Option[] = [
    { key: 'files', icon: 'insert-drive-file', label: 'Files', hint: 'Documents, spreadsheets, exports', onPress: onPickFiles },
    { key: 'photos', icon: 'image', label: 'Photos', hint: 'PNG, JPEG, HEIC, screenshots', onPress: onPickPhotos },
    { key: 'videos', icon: 'videocam', label: 'Videos', hint: 'MP4, MOV, WebM', onPress: onPickVideos },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={() => {
        const action = pendingAction.current;
        pendingAction.current = null;
        action?.();
      }}
    >
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: insets.bottom + 16,
              borderTopLeftRadius: theme.radii.sheetTop,
              borderTopRightRadius: theme.radii.sheetTop,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          {options.map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => selectOption(option.onPress)}
              style={styles.row}
              accessibilityRole="menuitem"
            >
              <View style={[styles.iconBox, { backgroundColor: theme.colors.accent + '1A' }]}>
                <Icon name={option.icon} size={20} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 15 }}>
                  {option.label}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 1 }}>{option.hint}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
