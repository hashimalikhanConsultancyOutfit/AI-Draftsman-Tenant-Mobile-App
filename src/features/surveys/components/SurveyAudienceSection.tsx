import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, PickerField, useToast } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import { getErrorMessage } from '@/services/apiErrorMessage';

import { useGetSurveyScheduleQuery, useLazyGetSurveyAudiencePreviewQuery, useSendSurveyNowMutation, useSetSurveyAudienceMutation } from '../surveysApi';
import type { SendSurveyNowResult, Survey } from '../surveys.types';
import {
  AUDIENCE_COPY,
  AUDIENCE_RULE_OPTIONS,
  SKIP_REASON_LABEL,
  activeScheduleWarning,
  audienceCriteria,
  editableRuleType,
  idsFromCriteria,
  needsPicker,
  sendBanner,
  sendBlockedReason,
  sendToast,
  type EditableRuleType,
} from '../surveysRules';
import { AudiencePicker } from './AudiencePicker';
import { Callout, Muted, Panel } from './Panel';
import { SurveySheet } from './SurveySheet';

interface SurveyAudienceSectionProps {
  survey: Survey;
  /** The detail page adds the Send panel; the wizard does not. */
  showSendNow?: boolean;
}

/**
 * Who gets the survey (web's `SurveyAudience`) and, on the detail page,
 * sending it right now. The send confirmation reads the audience preview
 * FRESH each time it opens (eligible/skipped and why), and warns when an
 * active schedule will also deliver it.
 */
export function SurveyAudienceSection({ survey, showSendNow = false }: SurveyAudienceSectionProps) {
  const toast = useToast();
  const saved = survey.audienceRule;
  const [ruleType, setRuleType] = useState<EditableRuleType>(editableRuleType(saved?.ruleType));
  const [userIds, setUserIds] = useState<string[]>(() => idsFromCriteria(saved?.criteria, 'userIds'));
  const [customerIds, setCustomerIds] = useState<string[]>(() => idsFromCriteria(saved?.criteria, 'customerIds'));

  /* Reseed only when a DIFFERENT survey is shown — a refetch must not wipe
     an edit in progress. */
  const seededFor = useRef(survey.id);
  useEffect(() => {
    if (seededFor.current === survey.id) return;
    seededFor.current = survey.id;
    setRuleType(editableRuleType(survey.audienceRule?.ruleType));
    setUserIds(idsFromCriteria(survey.audienceRule?.criteria, 'userIds'));
    setCustomerIds(idsFromCriteria(survey.audienceRule?.criteria, 'customerIds'));
  }, [survey.id, survey.audienceRule]);

  const [setAudience, { isLoading: isSaving }] = useSetSurveyAudienceMutation();
  const [sendNow, { isLoading: isSending }] = useSendSurveyNowMutation();
  const [loadPreview, preview] = useLazyGetSurveyAudiencePreviewQuery();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const schedule = useGetSurveyScheduleQuery(survey.id, { skip: !showSendNow || !confirmOpen });
  const [result, setResult] = useState<SendSurveyNowResult | null>(null);

  const saveAudience = async () => {
    const criteria = audienceCriteria(ruleType, userIds, customerIds);
    try {
      await setAudience({ id: survey.id, ruleType, ...(criteria ? { criteria } : {}) }).unwrap();
      toast.show(AUDIENCE_COPY.saved, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, AUDIENCE_COPY.saveFailed), { tone: 'error' });
    }
  };

  const blocked = sendBlockedReason(survey);
  const openConfirm = () => {
    if (blocked) {
      toast.show(blocked, { tone: 'warning' });
      return;
    }
    setConfirmOpen(true);
    void loadPreview(survey.id, false);
  };

  const confirmSend = async () => {
    try {
      const r = await sendNow(survey.id).unwrap();
      setResult(r);
      toast.show(sendToast(r.assignedCount, r.skippedCount), { tone: 'success' });
      setConfirmOpen(false);
    } catch (err) {
      toast.show(getErrorMessage(err as never, AUDIENCE_COPY.sendFailed), { tone: 'error' });
    }
  };

  const pickerEmpty = needsPicker(ruleType) && (ruleType === 'SPECIFIC_TENANT_USERS' ? userIds.length === 0 : customerIds.length === 0);
  const p = preview.data;
  const loadingPreview = preview.isFetching || !p;

  return (
    <View style={{ gap: 14 }}>
      <Panel title={AUDIENCE_COPY.title} action={<Button label={AUDIENCE_COPY.save} size="sm" onPress={saveAudience} loading={isSaving} />}>
        <PickerField label={AUDIENCE_COPY.ruleLabel} value={ruleType} options={AUDIENCE_RULE_OPTIONS} onChange={(v) => setRuleType(v as EditableRuleType)} />
        {ruleType === 'SPECIFIC_TENANT_USERS' ? <AudiencePicker kind="users" selectedIds={userIds} onChange={setUserIds} /> : null}
        {ruleType === 'SPECIFIC_CUSTOMERS' ? <AudiencePicker kind="customers" selectedIds={customerIds} onChange={setCustomerIds} /> : null}
        {pickerEmpty ? <Muted>{AUDIENCE_COPY.nobodySelected}</Muted> : null}
      </Panel>

      {showSendNow ? (
        <Panel title={AUDIENCE_COPY.sendTitle}>
          <Muted>{AUDIENCE_COPY.sendBody}</Muted>
          {/* Never truly disabled: a dimmed button still answers a tap with
              the reason, mobile's stand-in for web's helper line + tooltip. */}
          <Button label={isSending ? AUDIENCE_COPY.sending : AUDIENCE_COPY.sendNow} icon="send" onPress={openConfirm} loading={isSending} style={blocked ? { opacity: 0.5 } : undefined} />
          {blocked ? <Muted>{blocked}</Muted> : null}
          {result ? <Callout tone="success">{sendBanner(result.assignedCount, result.skippedCount)}</Callout> : null}
        </Panel>
      ) : null}

      <SurveySheet
        visible={confirmOpen}
        title={AUDIENCE_COPY.confirmTitle}
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setConfirmOpen(false)} disabled={isSending} style={{ flex: 1 }} />
            <Button label={AUDIENCE_COPY.sendNow} onPress={confirmSend} loading={isSending} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TagChip label={loadingPreview ? AUDIENCE_COPY.calculating : `${p.eligibleCount} eligible`} tone="success" />
          <TagChip label={loadingPreview ? '—' : `${p.skippedCount} skipped`} tone={p?.skippedCount ? 'warning' : 'neutral'} />
        </View>
        {p && Object.keys(p.skippedReasons ?? {}).length > 0 ? (
          <View style={{ gap: 4 }}>
            {Object.entries(p.skippedReasons).map(([reason, count]) => (
              <Muted key={reason}>{`${SKIP_REASON_LABEL[reason] ?? reason}: ${count}`}</Muted>
            ))}
          </View>
        ) : null}
        {preview.isError ? <Muted tone="error">{getErrorMessage(preview.error as never, 'Could not work out who would receive it.')}</Muted> : null}
        {schedule.data?.enabled ? <Muted tone="warning">{activeScheduleWarning(schedule.data.mode)}</Muted> : null}
        <Muted>{AUDIENCE_COPY.confirmBody}</Muted>
      </SurveySheet>
    </View>
  );
}
