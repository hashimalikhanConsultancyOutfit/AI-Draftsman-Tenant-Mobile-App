import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, Card, Icon, PickerField, Switch, TextField, useToast, type IconName } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useCreateSurveyVersionMutation } from '../surveysApi';
import type { SurveyDraft, SurveyField, SurveyFieldKind } from '../surveys.types';
import {
  FIELD_KIND_LABEL,
  FORM_COPY,
  MIN_OPTIONS,
  OPTION_BEARING_KINDS,
  REAL_FIELD_KIND_OPTIONS,
  addFieldToSection,
  addOption,
  addSection,
  changeFieldKind,
  changeFieldLabel,
  draftToBuilderFields,
  fieldsBlockedReason,
  groupFieldsBySections,
  hasRealFields,
  moveField,
  moveSection,
  removeField,
  removeOption,
  removeSection,
  seedFields,
  setOption,
  toSurveyFieldSchema,
  updateField,
  type BuilderField,
} from '../surveysRules';
import { Muted } from './Panel';
import { SurveyAiDraftSheet } from './SurveyAiDraftSheet';
import { SurveyFormRenderer } from './SurveyFormRenderer';
import { SurveySheet } from './SurveySheet';

interface SurveyFormEditorProps {
  surveyId: string;
  initialSchema: SurveyField[];
  /** "Finish" in the wizard, "Save changes" on the Survey Form tab. */
  saveLabel?: string;
  onSaved?: () => void;
}

/**
 * Web's `SurveyFormEditor` — the form as sections, each with its own
 * fields. Sections move as whole blocks; fields move within their own
 * section. Save captures a NEW version (`POST :id/versions`) and is held
 * back, with web's reason, until every section has a title, every field a
 * label and every select at least two options.
 */
export function SurveyFormEditor({ surveyId, initialSchema, saveLabel = 'Save changes', onSaved }: SurveyFormEditorProps) {
  const { theme } = useAppTheme();
  const toast = useToast();
  const [fields, setFields] = useState<BuilderField[]>(() => seedFields(initialSchema));
  const sections = useMemo(() => groupFieldsBySections(fields), [fields]);
  const blocked = fieldsBlockedReason(fields);
  const [createVersion, { isLoading: isSaving }] = useCreateSurveyVersionMutation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const previewSchema = useMemo(() => toSurveyFieldSchema(fields), [fields]);

  const save = async () => {
    if (blocked) {
      toast.show(blocked, { tone: 'warning' });
      return;
    }
    try {
      await createVersion({ id: surveyId, schema: toSurveyFieldSchema(fields) }).unwrap();
      toast.show(FORM_COPY.saved, { tone: 'success' });
      onSaved?.();
    } catch (err) {
      toast.show(getErrorMessage(err as never, FORM_COPY.saveFailed), { tone: 'error' });
    }
  };

  const confirmRemoveSection = (section: BuilderField, memberCount: number) =>
    Alert.alert(FORM_COPY.removeSectionTitle, FORM_COPY.removeSectionBody(section.label || 'Untitled section', memberCount), [
      { text: 'Cancel', style: 'cancel' },
      { text: FORM_COPY.removeSectionConfirm, style: 'destructive', onPress: () => setFields((f) => removeSection(f, section.uid)) },
    ]);

  const applyDraft = (draft: SurveyDraft) => {
    setFields(draftToBuilderFields(draft));
    toast.show(FORM_COPY.draftApplied(draft.title), { tone: 'success' });
    setAiOpen(false);
  };

  /* Over existing work, confirm first; on Cancel only the confirmation
     closes — the AI sheet stays open so the thread is not lost. */
  const handleUseDraft = (draft: SurveyDraft) => {
    if (!hasRealFields(fields)) {
      applyDraft(draft);
      return;
    }
    Alert.alert(FORM_COPY.overwriteTitle, FORM_COPY.overwriteBody, [
      { text: 'Cancel', style: 'cancel' },
      { text: FORM_COPY.overwriteConfirm, style: 'destructive', onPress: () => applyDraft(draft) },
    ]);
  };

  const iconBtn = (icon: IconName, label: string, onPress: () => void, disabled = false, danger = false) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.iconBtn, { borderColor: theme.colors.border, borderRadius: theme.radii.md, opacity: disabled ? 0.35 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={danger ? theme.colors.error : theme.colors.text} />
    </TouchableOpacity>
  );

  const renderField = (field: BuilderField, index: number, count: number) => {
    const optionBearing = OPTION_BEARING_KINDS.includes(field.kind);
    const filled = field.options.filter((o) => o.trim()).length;
    return (
      <View key={field.uid} style={[styles.field, { borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.background }]}>
        <View style={styles.fieldHead}>
          <Text style={{ flex: 1, color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{`Field ${index + 1} · ${FIELD_KIND_LABEL[field.kind]}`}</Text>
          {iconBtn('arrow-upward', 'Move field up', () => setFields((f) => moveField(f, field.uid, 'up')), index === 0)}
          {iconBtn('arrow-downward', 'Move field down', () => setFields((f) => moveField(f, field.uid, 'down')), index === count - 1)}
          {iconBtn('delete-outline', 'Remove field', () => setFields((f) => removeField(f, field.uid)), false, true)}
        </View>
        <TextField label={`${FORM_COPY.fieldLabel} *`} value={field.label} onChangeText={(t) => setFields((f) => changeFieldLabel(f, field.uid, t))} />
        <PickerField label={FORM_COPY.fieldKind} value={field.kind} options={REAL_FIELD_KIND_OPTIONS} onChange={(k) => setFields((f) => changeFieldKind(f, field.uid, k as SurveyFieldKind))} />
        <TextField label={FORM_COPY.fieldHelp} value={field.help} onChangeText={(t) => setFields((f) => updateField(f, field.uid, { help: t }))} />
        {optionBearing ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: filled < MIN_OPTIONS ? theme.colors.statusWarningFg : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: 12 }}>
              {FORM_COPY.optionsCounter(filled)}
            </Text>
            {field.options.map((option, i) => (
              <View key={i} style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <TextField placeholder={FORM_COPY.optionPlaceholder(i + 1)} value={option} onChangeText={(t) => setFields((f) => setOption(f, field.uid, i, t))} />
                </View>
                {iconBtn('close', `Remove option ${i + 1}`, () => setFields((f) => removeOption(f, field.uid, i)))}
              </View>
            ))}
            <Button label={FORM_COPY.addOption} icon="add" size="sm" variant="ghost" onPress={() => setFields((f) => addOption(f, field.uid))} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
        {field.kind === 'rating' ? <Muted>{FORM_COPY.ratingNote}</Muted> : null}
        <View style={styles.requiredRow}>
          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: 13 }}>{FORM_COPY.required}</Text>
          <Switch value={field.required} onValueChange={(v) => setFields((f) => updateField(f, field.uid, { required: v }))} accessibilityLabel={`${FORM_COPY.required}: ${field.label || 'field'}`} />
        </View>
      </View>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.toolbar}>
        <Button label={FORM_COPY.generate} icon="auto-awesome" variant="outline" size="sm" onPress={() => setAiOpen(true)} style={{ flex: 1 }} />
        <Button label={FORM_COPY.preview} icon="visibility" variant="outline" size="sm" onPress={() => setPreviewOpen(true)} style={{ flex: 1 }} />
      </View>

      {sections.map((section, si) => (
        <Card key={section.sectionField.uid} style={{ gap: 12 }}>
          <View style={styles.fieldHead}>
            <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{`Section ${si + 1}`}</Text>
            {iconBtn('arrow-upward', 'Move section up', () => setFields((f) => moveSection(f, section.sectionField.uid, 'up')), si === 0)}
            {iconBtn('arrow-downward', 'Move section down', () => setFields((f) => moveSection(f, section.sectionField.uid, 'down')), si === sections.length - 1)}
            {iconBtn('delete-outline', 'Remove section', () => confirmRemoveSection(section.sectionField, section.members.length), false, true)}
          </View>
          <TextField label={`${FORM_COPY.sectionTitle} *`} value={section.sectionField.label} onChangeText={(t) => setFields((f) => updateField(f, section.sectionField.uid, { label: t }))} />
          <TextField label={FORM_COPY.sectionHelp} value={section.sectionField.help} onChangeText={(t) => setFields((f) => updateField(f, section.sectionField.uid, { help: t }))} />
          {section.members.length === 0 ? <Muted>{FORM_COPY.emptySection}</Muted> : section.members.map((m, i) => renderField(m, i, section.members.length))}
          <Button label={FORM_COPY.addField} icon="add" variant="outline" size="sm" onPress={() => setFields((f) => addFieldToSection(f, section.sectionField.uid))} />
        </Card>
      ))}

      <Button label={FORM_COPY.addSection} icon="playlist-add" variant="ghost" onPress={() => setFields(addSection)} />

      {blocked ? <Muted tone="warning">{blocked}</Muted> : null}
      <Button label={isSaving ? 'Saving…' : saveLabel} onPress={save} loading={isSaving} fullWidth style={blocked ? { opacity: 0.5 } : undefined} />

      <SurveySheet visible={previewOpen} title={FORM_COPY.previewTitle} onClose={() => setPreviewOpen(false)} tall>
        <SurveyFormRenderer schema={previewSchema} />
      </SurveySheet>
      <SurveyAiDraftSheet surveyId={surveyId} visible={aiOpen} onClose={() => setAiOpen(false)} onUseDraft={handleUseDraft} />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 10 },
  field: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requiredRow: { flexDirection: 'row', alignItems: 'center' },
});
