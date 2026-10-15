import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SurveyDraft } from '../surveys.types';
import { AI_COPY, DRAFT_CARD_FIELD_LIMIT, FIELD_KIND_LABEL, FORM_COPY, type DrawerMessage } from '../surveysRules';
import { useSurveyDraftChat } from '../useSurveyDraftChat';
import { SurveyFormRenderer } from './SurveyFormRenderer';
import { SurveySheet } from './SurveySheet';

interface SurveyAiDraftSheetProps {
  surveyId: string;
  visible: boolean;
  onClose: () => void;
  onUseDraft: (draft: SurveyDraft) => void;
}

/**
 * Web's `SurveyAiChatDrawer` as a full-height sheet: the conversation, a
 * draft card on every COMPLETE reply ("Use this draft" / "Preview", up to
 * six fields then "+N more"), and a composer with file attachments. Nothing
 * is saved from here — a used draft lands in the editor for review first.
 */
export function SurveyAiDraftSheet({ surveyId, visible, onClose, onUseDraft }: SurveyAiDraftSheetProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const chat = useSurveyDraftChat(surveyId, visible);
  const scrollRef = useRef<ScrollView>(null);
  /* Rendered INSIDE this modal — iOS cannot present a second modal over a
     page sheet from outside it. */
  const [previewDraft, setPreviewDraft] = useState<SurveyDraft | null>(null);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [chat.messages.length, chat.awaiting]);

  const renderDraft = (draft: SurveyDraft) => {
    const real = draft.fields.filter((f) => f.kind !== 'section');
    const shown = real.slice(0, DRAFT_CARD_FIELD_LIMIT);
    return (
      <View style={[styles.draft, { borderColor: theme.colors.border, backgroundColor: theme.colors.background, borderRadius: theme.radii.md }]}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: 14 }}>{draft.title}</Text>
        {draft.description ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{draft.description}</Text> : null}
        <View style={{ gap: 3, marginTop: 4 }}>
          {shown.map((f) => (
            <Text key={f.key} style={{ color: theme.colors.text, fontSize: 12 }} numberOfLines={1}>
              {`• ${f.label} — ${FIELD_KIND_LABEL[f.kind] ?? f.kind}${f.required ? ' *' : ''}`}
            </Text>
          ))}
          {real.length > shown.length ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{AI_COPY.more(real.length - shown.length)}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button label={AI_COPY.useDraft} size="sm" onPress={() => onUseDraft(draft)} style={{ flex: 1 }} />
          <Button label={AI_COPY.preview} size="sm" variant="outline" onPress={() => setPreviewDraft(draft)} style={{ flex: 1 }} />
        </View>
      </View>
    );
  };

  const renderMessage = (m: DrawerMessage) => {
    const mine = m.role === 'user';
    return (
      <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 6 }}>
        <View
          style={[
            styles.bubble,
            {
              borderRadius: theme.radii.lg,
              backgroundColor: mine ? theme.colors.accent : m.isError ? theme.colors.statusErrorBg : theme.colors.surface,
              borderColor: mine ? theme.colors.accent : theme.colors.border,
            },
          ]}
        >
          {m.text ? <Text style={{ color: mine ? '#FFFFFF' : m.isError ? theme.colors.statusErrorFg : theme.colors.text, fontSize: 14, lineHeight: 20 }}>{m.text}</Text> : null}
          {(m.attachments ?? []).map((a) => (
            <View key={a.id} style={styles.attachRow}>
              <Icon name="attach-file" size={14} color={mine ? '#FFFFFF' : theme.colors.textMuted} />
              <Text style={{ color: mine ? '#FFFFFF' : theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                {a.name}
              </Text>
            </View>
          ))}
        </View>
        {m.draft ? <View style={{ width: '92%' }}>{renderDraft(m.draft)}</View> : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Icon name="auto-awesome" size={20} color={theme.colors.accent} />
          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>{AI_COPY.title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={24} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
            {chat.restoring ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.accent} />
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{AI_COPY.restoring}</Text>
              </View>
            ) : chat.messages.length === 0 ? (
              <EmptyState icon="auto-awesome" title={AI_COPY.emptyTitle} description={AI_COPY.emptyBody} />
            ) : (
              chat.messages.map(renderMessage)
            )}
            {chat.awaiting ? (
              <View style={styles.typing}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{AI_COPY.drafting}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.composer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 10 }]}>
            {chat.staged.length > 0 ? (
              <View style={styles.tray}>
                {chat.staged.map((a) => (
                  <View key={a.id} style={[styles.stagedChip, { borderColor: a.status === 'error' ? theme.colors.error : theme.colors.border, borderRadius: theme.radii.full }]}>
                    {a.status === 'uploading' ? <ActivityIndicator size="small" color={theme.colors.accent} /> : <Icon name={a.status === 'error' ? 'error-outline' : 'attach-file'} size={14} color={a.status === 'error' ? theme.colors.error : theme.colors.textMuted} />}
                    <Text style={{ color: theme.colors.text, fontSize: 12, maxWidth: 160 }} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <TouchableOpacity onPress={() => chat.removeStaged(a.id)} hitSlop={8} accessibilityLabel={`Remove ${a.name}`}>
                      <Icon name="close" size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.inputRow}>
              <TouchableOpacity onPress={chat.attach} disabled={chat.restoring} hitSlop={8} accessibilityRole="button" accessibilityLabel={AI_COPY.attach} style={{ opacity: chat.restoring ? 0.4 : 1 }}>
                <Icon name="attach-file" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
              <TextInput
                value={chat.value}
                onChangeText={chat.setValue}
                placeholder={AI_COPY.placeholder}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                editable={!chat.restoring}
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, borderRadius: theme.radii.md, fontFamily: theme.fontFamilies.body.regular }]}
              />
              <TouchableOpacity
                onPress={chat.send}
                disabled={!chat.canSend}
                style={[styles.send, { backgroundColor: theme.colors.accent, opacity: chat.canSend ? 1 : 0.4 }]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                <Icon name="arrow-upward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      <SurveySheet visible={previewDraft !== null} title={previewDraft?.title || FORM_COPY.previewTitle} onClose={() => setPreviewDraft(null)} tall>
        {previewDraft ? <SurveyFormRenderer schema={previewDraft.fields} /> : null}
      </SurveySheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  thread: { padding: 16, gap: 12, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  bubble: { maxWidth: '86%', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 9, gap: 4 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  draft: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 2 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stagedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 9, maxHeight: 120, fontSize: 14 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
