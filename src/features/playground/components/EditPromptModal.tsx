/**
 * EditPromptModal — "Save this prompt as a new version" for one roster
 * agent. Full-screen `Modal`, matching the shape already established by
 * `LeadCriteriaRulesScreen`'s add/edit rule modal: this app has no shared
 * dialog component, so each small standalone form gets its own.
 *
 * Two fields, mirrors web's `EDIT_PROMPT_FIELDS`: the prompt (required,
 * seeded from the agent currently loaded) and an optional change note.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { editPromptSchema, type EditPromptFormValues } from '../schemas/editPromptSchema';

interface EditPromptModalProps {
  visible: boolean;
  agentName: string;
  initialPrompt: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: EditPromptFormValues) => void;
}

export function EditPromptModal({ visible, agentName, initialPrompt, isSubmitting, onClose, onSubmit }: EditPromptModalProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditPromptFormValues>({
    resolver: yupResolver(editPromptSchema),
    values: { prompt: initialPrompt, note: '' },
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={`Edit prompt · ${agentName}`} mode="stack" onBack={onClose} />
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
          <Controller
            control={control}
            name="prompt"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="System prompt"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="The system prompt to save as a new version."
                multiline
                numberOfLines={8}
                style={{ minHeight: 160, textAlignVertical: 'top' }}
                error={errors.prompt?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="note"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label="Change note"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="What changed, and why"
                hint="Optional, but it is what makes the history readable later."
                error={errors.note?.message}
              />
            )}
          />
          <Button label="Save version" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
});
