import { useEffect, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Loader, PickerField, TextField, useToast } from '@/components/ui';
import type { SurveysStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { scheduleFormSchema } from './schemas/surveyFormSchemas';
import { useGetSurveyScheduleQuery, useSetSurveyScheduleMutation } from './surveysApi';
import {
  DAY_OF_MONTH_OPTIONS,
  END_CONDITION_OPTIONS,
  PRESET_OPTIONS,
  SCHEDULE_COPY,
  SCHEDULE_MODE_OPTIONS,
  WEEKDAY_OPTIONS,
  buildScheduleRequest,
  isPastOneTime,
  scheduleEditSeed,
  scheduleFormDefaults,
  scheduleTimezoneOptions,
  type ScheduleFormValues,
} from './surveysRules';

type Nav = NativeStackNavigationProp<SurveysStackParamList>;
type Rt = RouteProp<SurveysStackParamList, 'SurveyScheduleForm'>;

/**
 * Schedule this survey / Edit schedule — web's schedule `FormModal`. Every
 * field shows only when it applies (`showWhen`), and only a visible field
 * is validated. Dates and times are typed (`YYYY-MM-DD`, `HH:MM`), as in
 * this app's Reports form. A one-time date in the past is refused here with
 * web's toast before any request goes out; the server keeps its own floor.
 */
export function SurveyScheduleFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const existing = useGetSurveyScheduleQuery(params.surveyId);
  const [save, { isLoading }] = useSetSurveyScheduleMutation();
  const zones = useMemo(() => scheduleTimezoneOptions(), []);
  const isEdit = Boolean(existing.data);
  const copy = isEdit ? SCHEDULE_COPY.editForm : SCHEDULE_COPY.create;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: yupResolver(scheduleFormSchema) as never,
    defaultValues: scheduleFormDefaults(),
  });

  /* Seed from the saved schedule once it is known. */
  useEffect(() => {
    if (existing.data) reset(scheduleEditSeed(existing.data));
  }, [existing.data, reset]);

  const mode = watch('mode');
  const preset = watch('preset');
  const endCondition = watch('endCondition');
  const recurring = mode === 'RECURRING';

  const onSubmit = async (values: ScheduleFormValues) => {
    const request = buildScheduleRequest(params.surveyId, values);
    if (isPastOneTime(request)) {
      toast.show(SCHEDULE_COPY.pastDate, { tone: 'warning' });
      return;
    }
    try {
      await save(request).unwrap();
      toast.show(SCHEDULE_COPY.saved, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, SCHEDULE_COPY.saveFailed), { tone: 'error' });
    }
  };

  const picker = (name: keyof ScheduleFormValues, label: string, options: ReadonlyArray<{ value: string; label: string }>, extra?: { hint?: string; searchable?: boolean }) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <PickerField label={`${label} *`} value={String(value ?? '')} options={options} onChange={onChange} hint={extra?.hint} searchable={extra?.searchable} error={errors[name]?.message} />
      )}
    />
  );

  const input = (name: keyof ScheduleFormValues, label: string, extra?: { hint?: string; placeholder?: string; numeric?: boolean }) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <TextField
          label={`${label} *`}
          value={String(value ?? '')}
          onChangeText={onChange}
          onBlur={onBlur}
          placeholder={extra?.placeholder}
          hint={extra?.hint}
          keyboardType={extra?.numeric ? 'number-pad' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          error={errors[name]?.message}
        />
      )}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
      {existing.isLoading ? (
        <Loader fullScreen />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{copy.description}</Text>
            <Card style={{ gap: 14 }}>
              {picker('mode', 'Delivery', SCHEDULE_MODE_OPTIONS)}
              {picker('timezone', 'Timezone', zones, { hint: SCHEDULE_COPY.timezoneHint, searchable: true })}
              {!recurring ? (
                <>
                  {input('startDate', 'Date', { placeholder: 'YYYY-MM-DD', hint: SCHEDULE_COPY.dateHint })}
                  {input('startTime', 'Time', { placeholder: 'HH:MM' })}
                </>
              ) : (
                <>
                  {picker('preset', 'Repeats', PRESET_OPTIONS)}
                  {preset !== 'CUSTOM' ? (
                    <>
                      {input('hour', 'Hour (0–23)', { numeric: true })}
                      {input('minute', 'Minute (0–59)', { numeric: true })}
                    </>
                  ) : null}
                  {preset === 'WEEKLY' ? picker('dayOfWeek', 'Day of week', WEEKDAY_OPTIONS) : null}
                  {preset === 'MONTHLY' ? picker('dayOfMonth', 'Day of month', DAY_OF_MONTH_OPTIONS, { searchable: true }) : null}
                  {preset === 'CUSTOM' ? input('customCron', 'Cron expression', { placeholder: '0 */2 * * *', hint: SCHEDULE_COPY.cronHint }) : null}
                  {picker('endCondition', 'Ends', END_CONDITION_OPTIONS)}
                  {endCondition === 'DATE' ? input('endAt', 'End date', { placeholder: 'YYYY-MM-DD' }) : null}
                  {endCondition === 'COUNT' ? input('occurrenceLimit', 'Max occurrences', { numeric: true }) : null}
                </>
              )}
            </Card>
            <View style={styles.actions}>
              <Button label="Cancel" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} disabled={isLoading} />
              <Button label={copy.submit} onPress={handleSubmit(onSubmit)} loading={isLoading} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
