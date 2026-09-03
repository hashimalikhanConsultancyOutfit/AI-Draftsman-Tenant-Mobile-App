import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ComposerAttachment, ComposerBlock } from '../chat.types';
import { MAX_MESSAGE_LENGTH } from '../chatRules';
import { AttachSheet } from './AttachSheet';
import { ComposerAttachmentChip } from './ComposerAttachmentChip';

interface ComposerProps {
  block: ComposerBlock | null;
  onResolveBlock: (() => void) | null;
  isSending: boolean;
  isStreaming: boolean;
  /** The Stop button needs the live socket, not just "a turn exists" —
   * there is no REST cancel. */
  canCancel: boolean;
  attachments: ComposerAttachment[];
  isUploadingAttachment: boolean;
  onSend: (body: string) => void;
  onCancel: () => void;
  onTyping: () => void;
  onStopTyping: () => void;
  onPickFiles: () => void;
  onPickPhotos: () => void;
  onPickVideos: () => void;
  onRemoveAttachment: (localId: string) => void;
  onRetryAttachment: (localId: string) => void;
}

/**
 * The message composer.
 *
 * DELIBERATE DIVERGENCE from web (docs/chat-module-spec.md D-2): the web
 * sends on Enter and inserts a newline on Shift+Enter, which only works
 * because a physical keyboard has a Shift key. A phone's soft keyboard does
 * not, so Enter here is always a newline and Send is always the button —
 * otherwise every multi-line prompt would go out half-written the moment
 * someone hit the return key to start a new line.
 *
 * The block note renders ABOVE the field exactly where the web puts it, and
 * disables the field, attach button and mic together — never just the send
 * button — because a field the user can still type into while blocked
 * invites "why didn't sending do anything" more than a field that visibly
 * cannot be touched.
 */
export function Composer({
  block,
  onResolveBlock,
  isSending,
  isStreaming,
  canCancel,
  attachments,
  isUploadingAttachment,
  onSend,
  onCancel,
  onTyping,
  onStopTyping,
  onPickFiles,
  onPickPhotos,
  onPickVideos,
  onRemoveAttachment,
  onRetryAttachment,
}: ComposerProps) {
  const { theme } = useAppTheme();
  const [value, setValue] = useState('');
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const hasReadyAttachment = attachments.some((a) => a.state === 'ready');
  const isBlocked = block !== null;
  const canSend = !isBlocked && !isSending && !isUploadingAttachment && (value.trim().length > 0 || hasReadyAttachment);

  const handleChangeText = (text: string) => {
    setValue(text);
    if (text.length > 0) onTyping();
    else onStopTyping();
  };

  const handleSend = () => {
    if (!canSend) return;
    const body = value.trim();
    setValue('');
    onStopTyping();
    onSend(body);
  };

  const showCounter = value.length > 24000;
  const overLimit = value.length > MAX_MESSAGE_LENGTH;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      {block && (
        <TouchableOpacity
          disabled={!onResolveBlock}
          onPress={onResolveBlock ?? undefined}
          style={[styles.blockNote, { backgroundColor: theme.colors.statusWarningBg }]}
          accessibilityRole={onResolveBlock ? 'button' : 'text'}
        >
          <Icon name="info-outline" size={16} color={theme.colors.statusWarningFg} />
          <Text style={{ color: theme.colors.statusWarningFg, fontSize: 12, flex: 1 }}>{block.message}</Text>
          {onResolveBlock && <Icon name="chevron-right" size={16} color={theme.colors.statusWarningFg} />}
        </TouchableOpacity>
      )}

      {attachments.length > 0 && (
        <View style={styles.attachRow}>
          {attachments.map((a) => (
            <ComposerAttachmentChip
              key={a.localId}
              attachment={a}
              onRemove={() => onRemoveAttachment(a.localId)}
              onRetry={() => onRetryAttachment(a.localId)}
            />
          ))}
        </View>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity
          onPress={() => setAttachSheetOpen(true)}
          disabled={isBlocked}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Attach"
          style={styles.iconButton}
        >
          <Icon name="attach-file" size={24} color={isBlocked ? theme.colors.textMuted : theme.colors.text} />
        </TouchableOpacity>

        <View
          style={[
            styles.pill,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChangeText}
            onBlur={onStopTyping}
            multiline
            editable={!isBlocked}
            placeholder="Ask the agent…"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              { color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.md },
            ]}
            textAlignVertical="top"
            accessibilityLabel="Message"
          />
          {showCounter && (
            <Text style={{ color: overLimit ? theme.colors.error : theme.colors.textMuted, fontSize: 10, alignSelf: 'flex-end' }}>
              {value.length}/{MAX_MESSAGE_LENGTH}
            </Text>
          )}
        </View>

        {isStreaming ? (
          <TouchableOpacity
            onPress={onCancel}
            disabled={!canCancel}
            accessibilityRole="button"
            accessibilityLabel="Stop"
            style={[styles.sendCircle, { backgroundColor: canCancel ? theme.colors.error : theme.colors.border }]}
          >
            <Icon name="stop" size={18} color={theme.colors.textOnAccent} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[
              styles.sendCircle,
              { backgroundColor: canSend ? theme.colors.accent : theme.colors.border },
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={theme.colors.textOnAccent} />
            ) : (
              <Icon name="send" size={18} color={theme.colors.textOnAccent} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <AttachSheet
        visible={attachSheetOpen}
        onClose={() => setAttachSheetOpen(false)}
        onPickFiles={onPickFiles}
        onPickPhotos={onPickPhotos}
        onPickVideos={onPickVideos}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  blockNote: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  attachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconButton: { padding: 6, marginBottom: 4 },
  pill: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 140 },
  input: { maxHeight: 120, paddingTop: Platform.OS === 'android' ? 0 : 2 },
  sendCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
