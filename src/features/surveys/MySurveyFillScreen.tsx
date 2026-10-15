import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, ErrorState, Loader, useToast } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import type { MySurveysStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetMySurveyQuery, useMarkMySurveySeenMutation, useSubmitMySurveyResponseMutation } from './mySurveysApi';
import { FILL_COPY, MY_STATUS_LABEL, MY_STATUS_TONE, buildAnswers, fillDefaults, formatSubmitted, shouldMarkSeen, validateFill, type FillValues } from './mySurveysRules';
import { Callout, Panel } from './components/Panel';
import { SurveyFormRenderer } from './components/SurveyFormRenderer';

type Nav = NativeStackNavigationProp<MySurveysStackParamList>;
type Rt = RouteProp<MySurveysStackParamList, 'MySurveyFill'>;

/**
 * One assignment — web's `SurveyFill` (`/my-surveys/:assignmentId`).
 * Opening a NEW one marks it seen (once). Not completed → the form, every
 * required question checked with "{Label} is required" on Submit;
 * completed → "You already submitted this survey on …" and the answers.
 */
export function MySurveyFillScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: assignment, isLoading, isError, refetch } = useGetMySurveyQuery(params.assignmentId);
  const [markSeen] = useMarkMySurveySeenMutation();
  const [submit, { isLoading: isSubmitting }] = useSubmitMySurveyResponseMutation();

  const seenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!assignment || !shouldMarkSeen(assignment) || seenRef.current === assignment.id) return;
    seenRef.current = assignment.id;
    void markSeen(assignment.id);
  }, [assignment, markSeen]);

  const [values, setValues] = useState<FillValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!assignment || seededRef.current === assignment.id) return;
    seededRef.current = assignment.id;
    setValues(fillDefaults(assignment.version.schema));
  }, [assignment]);

  const change = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    /* An answered question drops its error straight away. */
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const onSubmit = async () => {
    if (!assignment) return;
    const schema = assignment.version.schema;
    const found = validateFill(schema, values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.show(FILL_COPY.fixErrors, { tone: 'warning' });
      return;
    }
    try {
      await submit({ assignmentId: assignment.id, answers: buildAnswers(schema, values) }).unwrap();
      toast.show(FILL_COPY.submitted, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, FILL_COPY.submitFailed), { tone: 'error' });
    }
  };

  const title = assignment?.survey.title ?? params.title ?? 'Survey';

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }
  if (isError || !assignment) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Survey" mode="stack" onBack={() => navigation.goBack()} />
        <View style={{ padding: 16 }}>
          <ErrorState title={FILL_COPY.loadError} message="The workflow service did not answer. Try again in a moment." onRetry={refetch} />
        </View>
      </View>
    );
  }

  const completed = assignment.status === 'COMPLETED';
  const schema = assignment.version.schema;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.xl }}>{assignment.survey.title}</Text>
            {assignment.survey.description ? (
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{assignment.survey.description}</Text>
            ) : null}
            <TagChip label={MY_STATUS_LABEL[assignment.status] ?? assignment.status} tone={MY_STATUS_TONE[assignment.status] ?? 'neutral'} />
          </View>

          {completed ? (
            <Panel title={FILL_COPY.completedTitle}>
              <Callout tone="success">{FILL_COPY.alreadySubmitted(assignment.completedAt)}</Callout>
              {assignment.response ? (
                <View style={{ gap: 12 }}>
                  {assignment.response.answers.map((a) => (
                    <View key={a.fieldKey} style={{ gap: 2 }}>
                      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.medium, fontSize: 12 }}>
                        {schema.find((f) => f.key === a.fieldKey)?.label ?? a.fieldKey}
                      </Text>
                      <Text style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>{formatSubmitted(a.value)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Panel>
          ) : (
            <Panel title={FILL_COPY.answersTitle}>
              <SurveyFormRenderer schema={schema} values={values} onChange={change} errors={errors} disabled={isSubmitting} />
              <Button label={isSubmitting ? FILL_COPY.submitting : FILL_COPY.submit} onPress={onSubmit} loading={isSubmitting} fullWidth />
            </Panel>
          )}

          <Button label={FILL_COPY.back} variant="outline" onPress={() => navigation.goBack()} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
});
