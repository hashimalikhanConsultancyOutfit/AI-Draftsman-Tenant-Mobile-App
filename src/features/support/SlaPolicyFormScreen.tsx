/**
 * Service level agreement settings. Ported from web's SLA policy dialog
 * (`Support.data.ts`'s `buildSlaFields`, confirmed against that source
 * 2026-09-04) — every field, its default and its hint copied verbatim.
 * Reachable only from a full-access session; see `SupportScreen`'s own
 * gate and the doc comment on `SUPPORT_PERMISSIONS` for why there is no
 * dedicated slug for this screen today.
 *
 * A PUT, not a PATCH: `onSubmit` always sends the whole shape, with
 * `businessHours`/`autoReplyHoldMins` collapsed to `null` when their own
 * switch is off — the two UI-only booleans (`useBusinessHours`,
 * `useAutoReply`) never reach the wire themselves.
 */
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, MultiSelectField, Switch, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportStackParamList } from '@/navigation/types';
import { useGetSupportSlaPolicyQuery, useUpdateSupportSlaPolicyMutation } from './supportApi';
import { slaPolicySchema, type SlaPolicyFormValues } from './schemas/slaPolicySchema';

type Nav = NativeStackNavigationProp<SupportStackParamList>;

const WEEKDAY_OPTIONS = [
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
  { label: 'Sunday', value: '7' },
];

const numericHandler = (onChange: (v: number | string) => void) => (t: string) => onChange(t === '' ? '' : Number(t.replace(/[^0-9]/g, '')));

export function SlaPolicyFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const { data: policy, isSuccess } = useGetSupportSlaPolicyQuery();
  const [updatePolicy, { isLoading: isSaving }] = useUpdateSupportSlaPolicyMutation();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SlaPolicyFormValues>({
    resolver: yupResolver(slaPolicySchema) as never,
    defaultValues: {
      firstResponseMins: 240,
      resolutionMins: 1440,
      atRiskPct: 75,
      pauseWhenAnswered: true,
      useBusinessHours: false,
      timezone: 'Europe/London',
      days: ['1', '2', '3', '4', '5'],
      start: '09:00',
      end: '17:30',
      useAutoReply: false,
      autoReplyHoldMins: 15,
    },
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isSuccess || !policy) return;
    const hours = policy.businessHours;
    reset({
      firstResponseMins: policy.firstResponseMins,
      resolutionMins: policy.resolutionMins,
      atRiskPct: policy.atRiskPct,
      pauseWhenAnswered: policy.pauseWhenAnswered,
      useBusinessHours: hours !== null,
      timezone: hours?.timezone ?? 'Europe/London',
      days: (hours?.days ?? [1, 2, 3, 4, 5]).map(String),
      start: hours?.start ?? '09:00',
      end: hours?.end ?? '17:30',
      useAutoReply: policy.autoReplyHoldMins !== null,
      autoReplyHoldMins: policy.autoReplyHoldMins ?? 15,
    });
    setHydrated(true);
  }, [hydrated, isSuccess, policy, reset]);

  const useBusinessHours = watch('useBusinessHours');
  const useAutoReply = watch('useAutoReply');

  const onSubmit = async (values: SlaPolicyFormValues) => {
    try {
      await updatePolicy({
        firstResponseMins: Number(values.firstResponseMins),
        resolutionMins: Number(values.resolutionMins),
        atRiskPct: Number(values.atRiskPct),
        pauseWhenAnswered: values.pauseWhenAnswered,
        businessHours: values.useBusinessHours
          ? { timezone: values.timezone ?? '', days: (values.days ?? []).map(Number), start: values.start ?? '', end: values.end ?? '' }
          : null,
        autoReplyHoldMins: values.useAutoReply ? Number(values.autoReplyHoldMins) : null,
      }).unwrap();
      toast.show('Service level agreement saved.', { tone: 'success' });
      if (values.useAutoReply) toast.show('Automatic replies are on — escalated tickets can now be answered and emailed with nobody in the loop.', { tone: 'warning', durationMs: 5000 });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not save that policy.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Service level agreement" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Card style={styles.section}>
          <Controller
            control={control}
            name="firstResponseMins"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="First reply target (minutes)"
                value={String(value)}
                onChangeText={numericHandler(onChange)}
                onBlur={onBlur}
                keyboardType="number-pad"
                hint={useBusinessHours ? 'Counted in WORKING minutes while working hours are set below.' : 'Counted in wall-clock minutes. Set working hours below to count only open time.'}
                error={errors.firstResponseMins?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="atRiskPct"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Amber at (% of the window)"
                value={String(value)}
                onChangeText={numericHandler(onChange)}
                onBlur={onBlur}
                keyboardType="number-pad"
                hint="Between 1 and 99. At 100 a ticket would breach without ever reading amber."
                error={errors.atRiskPct?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="resolutionMins"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Resolution target (minutes)"
                value={String(value)}
                onChangeText={numericHandler(onChange)}
                onBlur={onBlur}
                keyboardType="number-pad"
                hint="Stored for reporting. No badge or tile reads it yet."
                error={errors.resolutionMins?.message}
              />
            )}
          />
          <View style={styles.switchRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }}>Stop the clock while waiting on the customer</Text>
            <Controller control={control} name="pauseWhenAnswered" render={({ field: { value, onChange } }) => <Switch value={value} onValueChange={onChange} accessibilityLabel="Stop the clock while waiting on the customer" />} />
          </View>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>Answered tickets stop counting against the target until the customer replies.</Text>
        </Card>

        <Card style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }}>Only count working hours</Text>
            <Controller control={control} name="useBusinessHours" render={({ field: { value, onChange } }) => <Switch value={value} onValueChange={onChange} accessibilityLabel="Only count working hours" />} />
          </View>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>Off means the clock runs 24/7 — a ticket raised on Friday evening counts the weekend.</Text>

          {useBusinessHours ? (
            <>
              <Controller
                control={control}
                name="timezone"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField label="Timezone" value={value} onChangeText={onChange} onBlur={onBlur} autoCapitalize="none" placeholder="Europe/London" hint="An IANA zone name, e.g. Europe/London, Asia/Karachi, America/New_York." error={errors.timezone?.message} />
                )}
              />
              <Controller
                control={control}
                name="days"
                render={({ field: { value, onChange } }) => <MultiSelectField label="Working days" values={value ?? []} options={WEEKDAY_OPTIONS} onChange={onChange} searchable={false} />}
              />
              {errors.days?.message ? <Text style={{ color: theme.colors.error, fontSize: 11 }}>{errors.days.message}</Text> : null}
              <Controller
                control={control}
                name="start"
                render={({ field: { value, onChange, onBlur } }) => <TextField label="Opens" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="09:00" error={errors.start?.message} />}
              />
              <Controller
                control={control}
                name="end"
                render={({ field: { value, onChange, onBlur } }) => <TextField label="Closes" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="17:30" error={errors.end?.message} />}
              />
            </>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }}>Answer escalated tickets automatically</Text>
            <Controller control={control} name="useAutoReply" render={({ field: { value, onChange } }) => <Switch value={value} onValueChange={onChange} accessibilityLabel="Answer escalated tickets automatically" />} />
          </View>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, lineHeight: 16 }}>
            When a ticket is escalated, your support agent writes a reply and it is EMAILED to the customer with nobody in the loop. It is held first, and anyone who can see the ticket can stop it. It does not close the ticket or settle the SLA — the desk still owes a real answer.
          </Text>
          {useAutoReply ? (
            <Controller
              control={control}
              name="autoReplyHoldMins"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Hold it for (minutes)"
                  value={String(value)}
                  onChangeText={numericHandler(onChange)}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  hint="Roughly how long somebody has to read it and press Stop. 0 sends it within a minute, with no chance to intervene."
                  error={errors.autoReplyHoldMins?.message}
                />
              )}
            />
          ) : null}
        </Card>

        <Button label="Save policy" onPress={handleSubmit(onSubmit)} loading={isSaving} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
