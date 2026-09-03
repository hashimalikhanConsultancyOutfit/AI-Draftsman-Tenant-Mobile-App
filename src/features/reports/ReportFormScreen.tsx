/**
 * Create + Edit scheduled report — one shared screen, ported field-for-field
 * from web's `Reports.data.ts` (`REPORT_FIELDS`) and `useReports.tsx`
 * (confirmed against that source on 2026-09-03). Frequency first, then only
 * the schedule fields that frequency actually reads — `watch('frequency')`
 * plus `FIELDS_USED` decide which of Date / Day of week / Day of month /
 * Month / First month of cycle / Interval appear, the same rule the server
 * enforces in `normaliseSchedule`.
 *
 * ── DATE AND TIME ARE VALIDATED TEXT FIELDS, NOT A NATIVE PICKER ─────────────
 * This app has no calendar/clock picker component and none of its
 * dependencies provide one — adding `@react-native-community/datetimepicker`
 * (or similar) is a new native module, which needs a dev-client rebuild this
 * environment cannot perform or verify. Typed `YYYY-MM-DD` / `HH:MM` fields
 * carry exactly what web's own native `<input type="date">` /
 * `<input type="time">` produce underneath, validated against the same
 * shapes. Worth a native picker as a follow-up once a rebuild is in hand —
 * flagged here rather than assumed away.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, MultiSelectField, PickerField, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ReportsStackParamList } from '@/navigation/types';
import { useCreateReportMutation, useGetReportQuery, useUpdateReportMutation } from './reportsApi';
import {
  DAY_OF_MONTH_OPTIONS,
  DESTINATION_OPTIONS,
  FREQUENCY_OPTIONS,
  GROUP_BY_OPTIONS,
  MONTH_OPTIONS,
  QUARTER_START_OPTIONS,
  REPORT_FORM_DEFAULTS,
  REPORT_MODAL_COPY,
  WEEKDAY_OPTIONS,
  scheduleFromValues,
  toFormValues,
} from './reportsRules';
import { reportFormSchema, type ReportFormSchemaValues } from './schemas/reportFormSchema';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Rt = RouteProp<ReportsStackParamList, 'ReportForm'>;

function SectionHeading({ children }: { children: string }) {
  const { theme } = useAppTheme();
  return <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginBottom: 4 }}>{children}</Text>;
}

export function ReportFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);
  const copy = isEdit ? REPORT_MODAL_COPY.edit : REPORT_MODAL_COPY.create;

  const { data: editingReport, isLoading: isLoadingReport, error: loadError } = useGetReportQuery(params?.id ?? '', { skip: !isEdit });

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReportFormSchemaValues>({
    resolver: yupResolver(reportFormSchema) as never,
    defaultValues: REPORT_FORM_DEFAULTS,
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isEdit || !editingReport) return;
    reset(toFormValues(editingReport));
    setHydrated(true);
  }, [editingReport, hydrated, isEdit, reset]);

  const [createReport, { isLoading: isCreating }] = useCreateReportMutation();
  const [updateReport, { isLoading: isUpdating }] = useUpdateReportMutation();
  const isSubmitting = isCreating || isUpdating;

  const frequency = watch('frequency');

  const onSubmit = async (values: ReportFormSchemaValues) => {
    const name = values.name.trim();
    const schedule = scheduleFromValues(values);
    try {
      if (isEdit && editingReport) {
        await updateReport({ id: editingReport.id, name, dims: values.dims, dest: values.dest, ...schedule }).unwrap();
        toast.show(`${name} saved.`, { tone: 'success' });
      } else {
        await createReport({ name, dims: values.dims, dest: values.dest, ...schedule }).unwrap();
        toast.show(schedule.frequency === 'MANUAL' ? `${name} created. It only runs when you press Run now.` : `${name} scheduled.`, { tone: 'success' });
      }
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, `Could not ${isEdit ? 'save' : 'create'} that report.`), { tone: 'error' });
    }
  };

  if (isEdit && isLoadingReport) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && (loadError || !editingReport)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This report no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{copy.description}</Text>

        <Card style={styles.section}>
          <SectionHeading>Report</SectionHeading>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Report name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Weekly agent activity" error={errors.name?.message} />
            )}
          />
        </Card>

        <Card style={styles.section}>
          <SectionHeading>Schedule</SectionHeading>
          <Controller control={control} name="frequency" render={({ field: { value, onChange } }) => <PickerField label="How often" value={value} options={FREQUENCY_OPTIONS} onChange={onChange} />} />

          {frequency === 'MANUAL' ? (
            <Controller
              control={control}
              name="onceDate"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Date (optional)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  hint="Leave blank and it only runs when you press Run now. Set it and it runs itself once at that date and time, then never again."
                  error={errors.onceDate?.message}
                />
              )}
            />
          ) : null}

          {frequency === 'WEEKLY' ? (
            <Controller control={control} name="dayOfWeek" render={({ field: { value, onChange } }) => <PickerField label="Day of the week" value={value} options={WEEKDAY_OPTIONS} onChange={onChange} />} />
          ) : null}

          {frequency === 'MONTHLY' || frequency === 'QUARTERLY' || frequency === 'YEARLY' ? (
            <Controller
              control={control}
              name="dayOfMonth"
              render={({ field: { value, onChange } }) => (
                <PickerField label="Day of the month" value={value} options={DAY_OF_MONTH_OPTIONS} onChange={onChange} hint="Set to the last day and it runs on the 30th in April and the 28th in February — it never skips a month." />
              )}
            />
          ) : null}

          {frequency === 'YEARLY' ? (
            <Controller control={control} name="monthOfYear" render={({ field: { value, onChange } }) => <PickerField label="Month" value={value} options={MONTH_OPTIONS} onChange={onChange} />} />
          ) : null}

          {frequency === 'QUARTERLY' ? (
            <Controller control={control} name="quarterStart" render={({ field: { value, onChange } }) => <PickerField label="First month of the cycle" value={value} options={QUARTER_START_OPTIONS} onChange={onChange} />} />
          ) : null}

          {frequency === 'CUSTOM' ? (
            <Controller
              control={control}
              name="intervalDays"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Run every … days" value={String(value)} onChangeText={onChange} onBlur={onBlur} keyboardType="number-pad" hint="1 to 365. Counted from the first run, not from the calendar." error={errors.intervalDays?.message} />
              )}
            />
          ) : null}

          <Controller
            control={control}
            name="runAtMinute"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Time (UTC)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="HH:MM"
                autoCapitalize="none"
                hint="UTC, not local time: a local hour has no answer on the morning the clocks go forward and two on the morning they go back."
                error={errors.runAtMinute?.message}
              />
            )}
          />
        </Card>

        <Card style={styles.section}>
          <SectionHeading>Contents & delivery</SectionHeading>
          <Controller
            control={control}
            name="dims"
            render={({ field: { value, onChange } }) => (
              <MultiSelectField label="Group by" values={value ?? []} options={GROUP_BY_OPTIONS} onChange={onChange} searchable={false} hint="Each one becomes its own section in the export, with its own total." />
            )}
          />
          <Controller
            control={control}
            name="dest"
            render={({ field: { value, onChange } }) => (
              <PickerField label="Delivery channel" value={value} options={DESTINATION_OPTIONS} onChange={onChange} hint="Saved for when delivery ships. Nothing is sent yet — the file appears under Logs." />
            )}
          />
        </Card>

        <Button label={copy.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  section: { gap: 14 },
});
