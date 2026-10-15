import { useMemo } from 'react';
import { View } from 'react-native';

import { PickerField, TextField } from '@/components/ui';
import { useGetAllKnowledgeBasesLiteQuery } from '@/features/company-agents/companyAgentsApi';

import type { SurveyEvaluationMode, SurveyStatus } from '../surveys.types';
import { DETAILS_COPY, EVALUATION_MODE_OPTIONS, STATUS_OPTIONS, TITLE_MAX, evaluationHint, type SurveyDetailsValues } from '../surveysRules';

interface SurveyDetailsFieldsProps {
  values: SurveyDetailsValues;
  onChange: (patch: Partial<SurveyDetailsValues>) => void;
  /** The Details tab edits status; the wizard creates as DRAFT. */
  showStatus?: boolean;
  /** Once the wizard has created the survey its details are read-only. */
  disabled?: boolean;
  titleError?: string;
}

/**
 * The survey's own details — web's wizard Details step and the detail
 * page's Details tab share these fields: Title, Description, Knowledge
 * base for AI scoring, (Status), Evaluation mode.
 */
export function SurveyDetailsFields({ values, onChange, showStatus = false, disabled = false, titleError }: SurveyDetailsFieldsProps) {
  const { data: kbs, isFetching } = useGetAllKnowledgeBasesLiteQuery();
  const kbOptions = useMemo(() => [{ value: '', label: DETAILS_COPY.kbNone }, ...(kbs ?? []).map((k) => ({ value: k.id, label: k.name }))], [kbs]);

  return (
    <View style={{ gap: 14 }}>
      <TextField
        label={`${DETAILS_COPY.titleLabel} *`}
        value={values.title}
        onChangeText={(title) => onChange({ title })}
        maxLength={TITLE_MAX}
        editable={!disabled}
        error={titleError}
      />
      <TextField
        label={DETAILS_COPY.descriptionLabel}
        value={values.description}
        onChangeText={(description) => onChange({ description })}
        multiline
        numberOfLines={3}
        editable={!disabled}
        style={{ minHeight: 84, textAlignVertical: 'top', paddingTop: 10 }}
      />
      <PickerField
        label={DETAILS_COPY.kbLabel}
        value={values.evaluationKnowledgeBaseId}
        options={kbOptions}
        onChange={(evaluationKnowledgeBaseId) => onChange({ evaluationKnowledgeBaseId })}
        searchable={kbOptions.length > 6}
        disabled={disabled}
        hint={isFetching && !kbs ? 'Loading knowledge bases…' : DETAILS_COPY.kbHint}
      />
      {showStatus ? (
        <PickerField label={DETAILS_COPY.statusLabel} value={values.status} options={STATUS_OPTIONS} onChange={(status) => onChange({ status: status as SurveyStatus })} disabled={disabled} />
      ) : null}
      <PickerField
        label={DETAILS_COPY.evaluationLabel}
        value={values.evaluationMode}
        options={EVALUATION_MODE_OPTIONS}
        onChange={(mode) => onChange({ evaluationMode: mode as SurveyEvaluationMode })}
        disabled={disabled}
        hint={evaluationHint(values.evaluationMode)}
      />
    </View>
  );
}
