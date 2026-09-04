/**
 * Add an internal note. Ported from web's note dialog
 * (`Support.data.ts`'s `buildNoteFields`, confirmed against that source
 * 2026-09-04): one required field, deliberately no file picker — see
 * that source's long comment on why evidence belongs on the ticket's
 * own attachment list, not a note, since only a MESSAGE carries a
 * visibility flag and an attachment row does not.
 */
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { SupportStackParamList } from '@/navigation/types';
import { useAddSupportTicketNoteMutation, useGetSupportTicketQuery } from './supportApi';
import { noteSchema, type NoteFormValues } from './schemas/noteSchema';

type Nav = NativeStackNavigationProp<SupportStackParamList>;
type Rt = RouteProp<SupportStackParamList, 'NoteTicket'>;

export function NoteFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: ticket } = useGetSupportTicketQuery(params.id);
  const [addNote, { isLoading }] = useAddSupportTicketNoteMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteFormValues>({ resolver: yupResolver(noteSchema), defaultValues: { body: '' } });

  const onSubmit = async (values: NoteFormValues) => {
    try {
      await addNote({ id: params.id, body: values.body.trim() }).unwrap();
      toast.show(`Note added to ${ticket?.reference ?? 'the ticket'}. Only your workspace sees it.`, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not add that note.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Add an internal note" mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Card style={styles.section}>
          <Controller
            control={control}
            name="body"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Note"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Only your workspace can see this"
                multiline
                numberOfLines={5}
                style={{ minHeight: 110, paddingTop: 10, textAlignVertical: 'top' }}
                error={errors.body?.message}
                hint="Never emailed, never shown to the customer."
              />
            )}
          />
        </Card>
        <Button label="Add note" onPress={handleSubmit(onSubmit)} loading={isLoading} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 12 },
});
