import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, Checkbox, EmptyState, ErrorState, Loader, PickerField, TextField, useToast } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import { useGetSurveyResponseEvaluationQuery, useGetSurveyResponsesQuery, useReviewSurveyResponseMutation } from '../surveysApi';
import type { Survey, SurveyResponse } from '../surveys.types';
import {
  RATING_OPTIONS,
  RESPONSES_COPY,
  answerLabel,
  appendUnique,
  evaluationPollInterval,
  formatAnswerValue,
  reviewBody,
  sentimentTone,
} from '../surveysRules';
import { Callout, Muted, Panel } from './Panel';
import { SurveySheet } from './SurveySheet';

/** The Responses tab — web's `SurveyResponses`: one row per submission,
 * then a sheet with the answers and either the manual review or the AI
 * evaluation (polled every 4s until it settles). */
export function SurveyResponses({ survey }: { survey: Survey }) {
  const { theme } = useAppTheme();
  const isManual = survey.evaluationMode === 'MANUAL';
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<SurveyResponse[]>([]);
  const query = useGetSurveyResponsesQuery({ id: survey.id, cursor }, { refetchOnMountOrArgChange: true });
  useEffect(() => {
    if (!query.data) return;
    /* A refetch of a page already held (a saved review) refreshes rows in
       place; a new page appends. */
    setRows((prev) => {
      if (!cursor) return query.data!.items;
      const byId = new Map(query.data!.items.map((r) => [r.id, r]));
      return appendUnique(prev.map((r) => byId.get(r.id) ?? r), query.data!.items);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);
  const [openId, setOpenId] = useState<string | null>(null);
  const target = rows.find((r) => r.id === openId) ?? null;

  let body;
  if (query.isLoading) body = <Loader />;
  else if (query.isError && rows.length === 0) body = <ErrorState title={RESPONSES_COPY.errorTitle} message={RESPONSES_COPY.errorBody} onRetry={query.refetch} />;
  else if (rows.length === 0) body = <EmptyState icon="inbox" title={RESPONSES_COPY.emptyTitle} description={RESPONSES_COPY.emptyBody} />;
  else
    body = (
      <View style={{ gap: 8 }}>
        {rows.map((r) => {
          const ev = r.evaluationResult;
          return (
            <TouchableOpacity
              key={r.id}
              onPress={() => setOpenId(r.id)}
              activeOpacity={0.75}
              style={[styles.row, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
              accessibilityRole="button"
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{`Submitted ${formatRelativeTime(r.submittedAt)}`}</Text>
                <View style={styles.chips}>
                  <TagChip label={RESPONSES_COPY.answers(r.answers.length)} />
                  {isManual ? (
                    <>
                      <TagChip label={r.manualReview?.reviewed ? RESPONSES_COPY.reviewedLabel : RESPONSES_COPY.pending} tone={r.manualReview?.reviewed ? 'success' : 'warning'} />
                      <TagChip label={`Rating ${r.manualReview?.manualRating ? `${r.manualReview.manualRating}/5` : '—'}`} />
                    </>
                  ) : (
                    <>
                      <TagChip label={`Score ${ev?.score !== null && ev?.score !== undefined ? Math.round(ev.score) : '—'}`} tone="accent" />
                      {ev?.sentiment ? <TagChip label={ev.sentiment} tone={sentimentTone(ev.sentiment)} /> : null}
                    </>
                  )}
                </View>
              </View>
              <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{isManual ? RESPONSES_COPY.review : RESPONSES_COPY.view}</Text>
            </TouchableOpacity>
          );
        })}
        {query.data?.hasMore ? <Button label="Load more" variant="outline" loading={query.isFetching} onPress={() => query.data?.nextCursor && setCursor(query.data.nextCursor)} fullWidth /> : null}
      </View>
    );

  return (
    <>
      <Panel title={RESPONSES_COPY.title}>{body}</Panel>
      {target ? <ResponseSheet survey={survey} response={target} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function ResponseSheet({ survey, response, onClose }: { survey: Survey; response: SurveyResponse; onClose: () => void }) {
  const { theme } = useAppTheme();
  const toast = useToast();
  const isManual = survey.evaluationMode === 'MANUAL';
  const schema = useMemo(() => survey.versions?.find((v) => v.id === response.versionId)?.schema, [survey.versions, response.versionId]);
  const [reviewed, setReviewed] = useState(response.manualReview?.reviewed ?? false);
  const [rating, setRating] = useState(response.manualReview?.manualRating ? String(response.manualReview.manualRating) : '');
  const [notes, setNotes] = useState(response.manualReview?.notes ?? '');
  const [saveReview, { isLoading: isSaving }] = useReviewSurveyResponseMutation();

  const [poll, setPoll] = useState(4000);
  const evaluation = useGetSurveyResponseEvaluationQuery({ surveyId: survey.id, responseId: response.id }, { skip: isManual, pollingInterval: poll });
  useEffect(() => setPoll(evaluationPollInterval(evaluation.data?.status)), [evaluation.data?.status]);

  const submit = async () => {
    try {
      await saveReview({ surveyId: survey.id, responseId: response.id, ...reviewBody(reviewed, rating, notes) }).unwrap();
      toast.show(RESPONSES_COPY.reviewSaved, { tone: 'success' });
      onClose();
    } catch (err) {
      toast.show(getErrorMessage(err as never, RESPONSES_COPY.reviewFailed), { tone: 'error' });
    }
  };

  const ev = evaluation.data;
  return (
    <SurveySheet
      visible
      tall
      title={RESPONSES_COPY.sheetTitle}
      onClose={onClose}
      footer={
        <>
          <Button label={RESPONSES_COPY.close} variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={isSaving} />
          {isManual ? <Button label={isSaving ? 'Saving…' : RESPONSES_COPY.saveReview} onPress={submit} loading={isSaving} style={{ flex: 1 }} /> : null}
        </>
      }
    >
      <Muted>{`Submitted ${formatRelativeTime(response.submittedAt)}`}</Muted>
      <View style={{ gap: 10 }}>
        {response.answers.map((a) => (
          <View key={a.fieldKey} style={{ gap: 2 }}>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: 12 }}>{answerLabel(schema, a.fieldKey)}</Text>
            <Text style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>{formatAnswerValue(schema, a.fieldKey, a.value)}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      {isManual ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{RESPONSES_COPY.manualReview}</Text>
          <Checkbox label={RESPONSES_COPY.reviewedLabel} checked={reviewed} onChange={setReviewed} />
          <PickerField label={RESPONSES_COPY.ratingLabel} value={rating} options={RATING_OPTIONS} onChange={setRating} />
          <TextField label={RESPONSES_COPY.notesLabel} value={notes} onChangeText={setNotes} multiline numberOfLines={3} style={{ minHeight: 84, textAlignVertical: 'top', paddingTop: 10 }} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{RESPONSES_COPY.aiEvaluation}</Text>
          {evaluation.isError ? (
            <Callout tone="danger">{RESPONSES_COPY.evaluationError}</Callout>
          ) : evaluation.isLoading && ev === undefined ? (
            <Muted>{RESPONSES_COPY.evaluating}</Muted>
          ) : !ev || ev.status === 'PENDING' ? (
            <Callout>{RESPONSES_COPY.pendingEvaluation}</Callout>
          ) : ev.status === 'FAILED' ? (
            <Callout>{RESPONSES_COPY.failedEvaluation}</Callout>
          ) : (
            <>
              <View style={styles.chips}>
                <TagChip label={RESPONSES_COPY.score(ev.score)} tone="accent" />
                {ev.sentiment ? <TagChip label={ev.sentiment} tone={sentimentTone(ev.sentiment)} /> : null}
                {(ev.tags ?? []).map((t) => (
                  <TagChip key={t} label={t} tone="info" outlined />
                ))}
              </View>
              {ev.summary ? <Muted>{ev.summary}</Muted> : null}
            </>
          )}
        </View>
      )}
    </SurveySheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
