import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, ErrorState, Loader, StatusTabs, useToast } from '@/components/ui';
import { TagChip } from '@/features/agent-teams/components/TagChip';
import type { SurveysStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetSurveyQuery, useUpdateSurveyMutation } from './surveysApi';
import type { Survey } from './surveys.types';
import {
  DETAIL_COPY,
  DETAIL_TABS,
  DETAIL_TAB_LABEL,
  DETAILS_COPY,
  STATUS_LABEL,
  STATUS_TONE,
  currentVersionSchema,
  detailsFromSurvey,
  surveyDetailsPatch,
  type DetailTab,
  type SurveyDetailsValues,
} from './surveysRules';
import { Panel } from './components/Panel';
import { SurveyAudienceSection } from './components/SurveyAudienceSection';
import { SurveyDetailsFields } from './components/SurveyDetailsFields';
import { SurveyFormEditor } from './components/SurveyFormEditor';
import { SurveyOverview } from './components/SurveyOverview';
import { SurveyResponses } from './components/SurveyResponses';
import { SurveyScheduleSection } from './components/SurveyScheduleSection';

type Nav = NativeStackNavigationProp<SurveysStackParamList>;
type Rt = RouteProp<SurveysStackParamList, 'SurveyDetail'>;

const TABS = DETAIL_TABS.map((value) => ({ value, label: DETAIL_TAB_LABEL[value] }));

/**
 * A survey's page — web's `SurveyDetail`: title, description and status
 * up top, then Overview / Details / Survey Form / Audience & Schedule /
 * Responses.
 */
export function SurveyDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [tab, setTab] = useState<DetailTab>(params.tab ?? 'overview');
  const { data: survey, isLoading, isError, error, isFetching, refetch } = useGetSurveyQuery(params.id);

  const title = survey?.title ?? params.title ?? 'Survey';

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }
  if (isError || !survey) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <View style={{ padding: 16 }}>
          <ErrorState title={DETAIL_COPY.loadErrorTitle} message={getErrorMessage(error as never, DETAIL_COPY.loadErrorBody)} onRetry={refetch} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.xl }}>{survey.title}</Text>
            {survey.description ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{survey.description}</Text> : null}
            <TagChip label={STATUS_LABEL[survey.status] ?? survey.status} tone={STATUS_TONE[survey.status] ?? 'neutral'} />
          </View>
          <StatusTabs tabs={TABS} value={tab} onChange={(v) => setTab(v as DetailTab)} />

          {tab === 'overview' ? <SurveyOverview survey={survey} /> : null}
          {tab === 'details' ? <DetailsTab survey={survey} /> : null}
          {/* Keyed by version, so a saved form (a new version) reseeds the editor. */}
          {tab === 'form' ? <SurveyFormEditor key={survey.currentVersionId} surveyId={survey.id} initialSchema={currentVersionSchema(survey)} /> : null}
          {tab === 'targeting' ? (
            <View style={{ gap: 14 }}>
              <SurveyAudienceSection survey={survey} showSendNow />
              <SurveyScheduleSection survey={survey} />
            </View>
          ) : null}
          {tab === 'responses' ? <SurveyResponses survey={survey} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Web's `SurveyDetails` tab — Save changes is enabled only once something
 * changed, and sends only what changed. */
function DetailsTab({ survey }: { survey: Survey }) {
  const toast = useToast();
  const [values, setValues] = useState<SurveyDetailsValues>(() => detailsFromSurvey(survey));
  useEffect(() => setValues(detailsFromSurvey(survey)), [survey]);
  const patch = useMemo(() => surveyDetailsPatch(survey, values), [survey, values]);
  const dirty = Object.keys(patch).length > 0;
  const [update, { isLoading }] = useUpdateSurveyMutation();

  const save = async () => {
    if (!values.title.trim()) {
      toast.show(DETAILS_COPY.titleRequiredSave, { tone: 'warning' });
      return;
    }
    try {
      await update({ id: survey.id, ...patch }).unwrap();
      toast.show(DETAILS_COPY.updated, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, DETAILS_COPY.updateFailed), { tone: 'error' });
    }
  };

  return (
    <Panel title="Details">
      <SurveyDetailsFields values={values} onChange={(p) => setValues((v) => ({ ...v, ...p }))} showStatus />
      <Button label={isLoading ? 'Saving…' : DETAILS_COPY.saveChanges} onPress={save} loading={isLoading} disabled={!dirty} fullWidth />
    </Panel>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
});
