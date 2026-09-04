/**
 * Edit ticket: subject, owner, priority, state. Ported from web's edit
 * dialog (`Support.data.ts`'s `buildEditFields`/`buildStateField` +
 * `useSupport.tsx`'s `submitEdit`, confirmed against that source
 * 2026-09-04) — including the one rule worth restating: choosing "with
 * AiDraftsman" in the State field does not PATCH the ticket, it routes
 * to the escalate endpoint instead, because `WITH_PLATFORM` is a
 * handover with a privacy contract, never a plain state value (see
 * `support.dto.ts`'s `UpdateTicketDto`). The option is offered here,
 * rather than only from the ticket screen's own Escalate button, because
 * someone changing state is where they will look for it.
 *
 * One disclosed deviation from web: the State select there shows
 * "with AiDraftsman" DISABLED (with a caption) when the viewer lacks
 * `support.escalate`; this app's `PickerField` has no per-option
 * disabled state, so that option is omitted entirely rather than shown
 * inert — consistent with this app's general hide-when-ungated
 * convention (Team's "Invite member", Roles' "Add role").
 */
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, PickerField, TextField, useToast } from '@/components/ui';
import { useGetTeamQuery } from '@/features/team/teamApi';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportStackParamList } from '@/navigation/types';
import { useEscalateSupportTicketMutation, useGetSupportTicketQuery, useUpdateSupportTicketMutation } from './supportApi';
import { editTicketSchema, type EditTicketFormValues } from './schemas/editTicketSchema';
import { escalationToast, NEXT_STATES, PRIORITY_OPTIONS, TICKET_STATE_LABEL, UNASSIGNED_VALUE } from './supportRules';
import type { SupportTicketState } from './support.types';

type Nav = NativeStackNavigationProp<SupportStackParamList>;
type Rt = RouteProp<SupportStackParamList, 'EditTicket'>;

export function EditTicketFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: ticket, isLoading, error } = useGetSupportTicketQuery(params.id);
  const { data: team } = useGetTeamQuery();
  const [updateTicket, { isLoading: isSaving }] = useUpdateSupportTicketMutation();
  const [escalateTicket, { isLoading: isEscalating }] = useEscalateSupportTicketMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTicketFormValues>({
    resolver: yupResolver(editTicketSchema),
    defaultValues: { subject: '', assigneeId: UNASSIGNED_VALUE, priority: 'NORMAL', state: 'OPEN' },
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !ticket) return;
    reset({ subject: ticket.subject, assigneeId: ticket.owner.id ?? UNASSIGNED_VALUE, priority: ticket.priority, state: ticket.state });
    setHydrated(true);
  }, [hydrated, ticket, reset]);

  const memberOptions = [
    { label: 'Unassigned', value: UNASSIGNED_VALUE },
    ...(team ?? []).map((m) => ({ label: m.acceptedAt ? m.name || m.email : `${m.name || m.email} (invited)`, value: m.id })),
  ];

  const stateOptions = ticket
    ? [ticket.state, ...NEXT_STATES[ticket.state]]
        .map((s) => ({ label: TICKET_STATE_LABEL[s], value: s }))
        .concat(ticket.state !== 'WITH_PLATFORM' && ticket.can.escalate ? [{ label: TICKET_STATE_LABEL.WITH_PLATFORM, value: 'WITH_PLATFORM' as SupportTicketState }] : [])
    : [];

  const onSubmit = async (values: EditTicketFormValues) => {
    if (!ticket) return;
    try {
      const nextOwner = !values.assigneeId || values.assigneeId === UNASSIGNED_VALUE ? null : values.assigneeId;
      const ownerChanged = nextOwner !== (ticket.owner.id ?? null);
      const wantsEscalation = values.state === 'WITH_PLATFORM' && ticket.state !== 'WITH_PLATFORM';
      const nextState = wantsEscalation ? undefined : (values.state as Exclude<typeof values.state, 'WITH_PLATFORM'>);
      const stateChanged = Boolean(nextState && nextState !== ticket.state);
      const priorityChanged = values.priority !== ticket.priority;
      const subject = values.subject.trim();
      const subjectChanged = subject !== ticket.subject;

      const patch = {
        ...(subjectChanged ? { subject } : {}),
        ...(ownerChanged ? { assigneeId: nextOwner } : {}),
        ...(priorityChanged ? { priority: values.priority as never } : {}),
        ...(stateChanged ? { state: nextState as never } : {}),
      };
      const edited = Object.keys(patch).length > 0;

      if (edited) {
        await updateTicket({ id: ticket.id, ...patch, expectedUpdatedAt: ticket.updatedAt }).unwrap();
      }

      if (wantsEscalation) {
        await escalateTicket({ id: ticket.id }).unwrap();
        toast.show(escalationToast(ticket.subject), { tone: 'success' });
      } else if (edited) {
        toast.show(`Ticket ${ticket.reference} updated.`, { tone: 'success' });
      } else {
        toast.show('Nothing to save — no changes were made.', { tone: 'neutral' });
      }
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not save that ticket.'), { tone: 'error' });
    }
  };

  if (isLoading && !ticket) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit ticket" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (!isLoading && (!ticket || error)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Edit ticket" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This ticket no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Edit ticket" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Card style={styles.section}>
          <Controller
            control={control}
            name="subject"
            render={({ field: { value, onChange, onBlur } }) => <TextField label="Subject" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.subject?.message} />}
          />
          <Controller
            control={control}
            name="assigneeId"
            render={({ field: { value, onChange } }) => <PickerField label="Owner" value={value} options={memberOptions} onChange={onChange} />}
          />
          <Controller
            control={control}
            name="priority"
            render={({ field: { value, onChange } }) => (
              <PickerField
                label="Priority"
                value={value}
                options={PRIORITY_OPTIONS}
                onChange={onChange}
                hint="Changes how this ticket reads. The first-response deadline was set when it was raised and stays as it is."
              />
            )}
          />
          <Controller control={control} name="state" render={({ field: { value, onChange } }) => <PickerField label="State" value={value} options={stateOptions} onChange={onChange} />} />
        </Card>

        <Button label="Save" onPress={handleSubmit(onSubmit)} loading={isSaving || isEscalating} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 12 },
});
