import { yupResolver } from '@hookform/resolvers/yup';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, PickerField, TextField, useToast } from '@/components/ui';
import { threadDisplayName } from '@/features/chat/chatRules';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useCreateAgentTeamScheduleMutation, useGetTeamThreadsQuery } from './agentTeamsApi';
import { DEFAULT_SCHEDULE_PRESET, SCHEDULE_COPY, SCHEDULE_PRESET_OPTIONS, deviceTimezone, timezoneOptions } from './agentTeamsRules';
import { scheduleFormSchema, type ScheduleFormValues } from './schemas/agentTeamFormSchemas';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type Rt = RouteProp<AgentTeamsStackParamList, 'AgentTeamScheduleForm'>;

/**
 * Schedule this team — web's `addSchedule` dialog. How often (a preset
 * LABEL, weekdays preselected), Thread (optional: a new thread of its own,
 * or one of this team's), What should the team do (required, sent as the
 * message on every occurrence) and Timezone (defaults to the device's own,
 * so "07:00" means 07:00 where the user is).
 */
export function ScheduleFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const threadsQuery = useGetTeamThreadsQuery(params.teamId);
  const [createSchedule, { isLoading }] = useCreateAgentTeamScheduleMutation();

  const threadOptions = useMemo(
    () => [{ value: '', label: SCHEDULE_COPY.newThreadLabel }, ...(threadsQuery.data ?? []).map((t) => ({ value: t.id, label: threadDisplayName(t.title) }))],
    [threadsQuery.data],
  );
  const zones = useMemo(() => timezoneOptions(), []);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: yupResolver(scheduleFormSchema) as never,
    defaultValues: { preset: DEFAULT_SCHEDULE_PRESET, conversationId: '', objective: '', timezone: deviceTimezone() },
  });

  const onSubmit = async (values: ScheduleFormValues) => {
    const conversationId = values.conversationId.trim();
    const timezone = values.timezone.trim();
    try {
      await createSchedule({
        teamId: params.teamId,
        body: {
          preset: values.preset,
          /* Omitted for "New thread for this schedule" — the server opens one. */
          ...(conversationId ? { conversationId } : {}),
          objective: values.objective.trim(),
          /* Omitted rather than sent empty — '' is not a valid IANA zone. */
          ...(timezone ? { timezone } : {}),
        },
      }).unwrap();
      toast.show(SCHEDULE_COPY.created, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not create that schedule.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={SCHEDULE_COPY.formTitle} mode="stack" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{SCHEDULE_COPY.formDescription}</Text>

          <Card style={{ gap: 14 }}>
            <Controller
              control={control}
              name="preset"
              render={({ field: { value, onChange } }) => (
                <PickerField label="How often *" value={value} options={SCHEDULE_PRESET_OPTIONS} onChange={onChange} hint={SCHEDULE_COPY.presetHint} error={errors.preset?.message} />
              )}
            />
            <Controller
              control={control}
              name="conversationId"
              render={({ field: { value, onChange } }) => (
                <PickerField
                  label="Thread"
                  value={value}
                  options={threadOptions}
                  onChange={onChange}
                  searchable={threadOptions.length > 6}
                  hint={threadsQuery.isFetching ? 'Loading this team’s threads…' : SCHEDULE_COPY.threadHint}
                />
              )}
            />
            <Controller
              control={control}
              name="objective"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="What should the team do *"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 96, textAlignVertical: 'top', paddingTop: 10 }}
                  hint={SCHEDULE_COPY.objectiveHint}
                  error={errors.objective?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="timezone"
              render={({ field: { value, onChange } }) => (
                <PickerField label="Timezone" value={value} options={zones} onChange={onChange} searchable placeholder="Search a city or offset, e.g. Karachi or +05" hint={SCHEDULE_COPY.timezoneHint} />
              )}
            />
          </Card>

          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} disabled={isLoading} />
            <Button label={SCHEDULE_COPY.formSubmit} onPress={handleSubmit(onSubmit)} loading={isLoading} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
