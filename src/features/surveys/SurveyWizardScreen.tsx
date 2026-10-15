import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, ErrorState, Loader, useToast } from '@/components/ui';
import type { SurveysStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useCreateSurveyMutation, useGetSurveyQuery } from './surveysApi';
import {
  DETAILS_COPY,
  WIZARD_STEPS,
  WIZARD_STEP_LABEL,
  createSurveyBody,
  currentVersionSchema,
  type SurveyDetailsValues,
  type WizardStep,
} from './surveysRules';
import { Panel } from './components/Panel';
import { SurveyAudienceSection } from './components/SurveyAudienceSection';
import { SurveyDetailsFields } from './components/SurveyDetailsFields';
import { SurveyFormEditor } from './components/SurveyFormEditor';
import { SurveyScheduleSection } from './components/SurveyScheduleSection';

type Nav = NativeStackNavigationProp<SurveysStackParamList>;

/**
 * New survey — web's three-step wizard (`SurveyBuilder`): Details →
 * Audience & Schedule → Survey Form. The survey is CREATED when the
 * Details step is left (Next or Finish later), as an empty draft; from then
 * on the details are locked here and every later step works against the
 * real survey. Finish later and the form's Finish both land on the
 * survey's own page.
 */
export function SurveyWizardScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const [step, setStep] = useState<WizardStep>('details');
  const [visited, setVisited] = useState<Set<WizardStep>>(new Set(['details']));
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [values, setValues] = useState<SurveyDetailsValues>({ title: '', description: '', status: 'DRAFT', evaluationMode: 'MANUAL', evaluationKnowledgeBaseId: '' });
  const [createSurvey, { isLoading: isCreating }] = useCreateSurveyMutation();
  const surveyQuery = useGetSurveyQuery(surveyId ?? '', { skip: !surveyId });
  const locked = Boolean(surveyId);

  const goTo = (target: WizardStep) => {
    setStep(target);
    setVisited((v) => new Set(v).add(target));
  };

  const createIfNeeded = async (): Promise<string | null> => {
    if (surveyId) return surveyId;
    if (!values.title.trim()) {
      toast.show(DETAILS_COPY.titleRequiredContinue, { tone: 'warning' });
      return null;
    }
    try {
      const created = await createSurvey(createSurveyBody(values)).unwrap();
      toast.show(DETAILS_COPY.created(created.title), { tone: 'success' });
      setSurveyId(created.id);
      return created.id;
    } catch (err) {
      toast.show(getErrorMessage(err as never, DETAILS_COPY.createFailed), { tone: 'error' });
      return null;
    }
  };

  const openSurvey = (id: string) => navigation.replace('SurveyDetail', { id, title: surveyQuery.data?.title ?? values.title.trim() });

  const next = async () => {
    const id = await createIfNeeded();
    if (id) goTo('targeting');
  };
  const finishLater = async () => {
    const id = await createIfNeeded();
    if (id) openSurvey(id);
  };
  const back = () => setStep(step === 'fields' ? 'targeting' : 'details');
  const canJump = (target: WizardStep) => target === 'details' || (Boolean(surveyId) && visited.has(target));

  const scoped = (render: () => ReactNode) =>
    surveyQuery.isLoading || (!surveyQuery.data && !surveyQuery.isError) ? (
      <Loader />
    ) : surveyQuery.isError ? (
      <ErrorState title="Could not load this survey" message="The workflow service did not answer. Try again in a moment." onRetry={surveyQuery.refetch} />
    ) : (
      render()
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={DETAILS_COPY.wizardTitle} mode="stack" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{DETAILS_COPY.wizardDescription}</Text>

          {/* Web's Stepper — a reached step can be jumped back to. */}
          <View style={styles.stepper}>
            {WIZARD_STEPS.map((s, i) => {
              const active = s === step;
              const done = !active && canJump(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={styles.step}
                  disabled={active || !canJump(s)}
                  onPress={() => goTo(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: active || !canJump(s) }}
                >
                  <View style={[styles.stepDot, { backgroundColor: active || done ? theme.colors.accent : theme.colors.statusNeutralBg }]}>
                    <Text style={{ color: active || done ? '#FFFFFF' : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{done ? '✓' : String(i + 1)}</Text>
                  </View>
                  <Text style={{ color: active ? theme.colors.text : theme.colors.textMuted, fontFamily: active ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.regular, fontSize: 12, textAlign: 'center' }} numberOfLines={2}>
                    {WIZARD_STEP_LABEL[s]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {step === 'details' ? (
            <>
              <Panel title={WIZARD_STEP_LABEL.details}>
                <SurveyDetailsFields values={values} onChange={(p) => setValues((v) => ({ ...v, ...p }))} disabled={locked} />
              </Panel>
              <Button label={isCreating ? 'Saving…' : DETAILS_COPY.nextTargeting} onPress={next} loading={isCreating} fullWidth style={!locked && !values.title.trim() ? { opacity: 0.5 } : undefined} />
              <View style={styles.row}>
                {!locked ? <Button label={DETAILS_COPY.cancel} variant="outline" onPress={() => navigation.goBack()} disabled={isCreating} style={{ flex: 1 }} /> : null}
                <Button label={DETAILS_COPY.finishLater} variant="ghost" onPress={finishLater} disabled={isCreating} style={{ flex: 1 }} />
              </View>
            </>
          ) : null}

          {step === 'targeting'
            ? scoped(() => (
                <>
                  <SurveyAudienceSection survey={surveyQuery.data!} />
                  <SurveyScheduleSection survey={surveyQuery.data!} />
                  <Button label={DETAILS_COPY.nextForm} onPress={() => goTo('fields')} fullWidth />
                  <View style={styles.row}>
                    <Button label={DETAILS_COPY.back} variant="outline" onPress={back} style={{ flex: 1 }} />
                    <Button label={DETAILS_COPY.finishLater} variant="ghost" onPress={() => surveyId && openSurvey(surveyId)} style={{ flex: 1 }} />
                  </View>
                </>
              ))
            : null}

          {step === 'fields'
            ? scoped(() => (
                <>
                  <SurveyFormEditor
                    key={surveyQuery.data!.currentVersionId}
                    surveyId={surveyQuery.data!.id}
                    initialSchema={currentVersionSchema(surveyQuery.data!)}
                    saveLabel={DETAILS_COPY.finish}
                    onSaved={() => surveyId && openSurvey(surveyId)}
                  />
                  <Button label={DETAILS_COPY.back} variant="outline" onPress={back} fullWidth />
                </>
              ))
            : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  stepper: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10 },
});
