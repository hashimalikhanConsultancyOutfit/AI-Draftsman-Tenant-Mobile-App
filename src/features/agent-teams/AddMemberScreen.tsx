import { yupResolver } from '@hookform/resolvers/yup';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Loader, PickerField, useToast } from '@/components/ui';
import { useGetAvailableAgentsForChatQuery } from '@/features/chat/chatApi';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useAddAgentTeamMemberMutation, useGetAgentTeamQuery } from './agentTeamsApi';
import { MEMBER_COPY } from './agentTeamsRules';
import { addMemberSchema, type AddMemberFormValues } from './schemas/agentTeamFormSchemas';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type Rt = RouteProp<AgentTeamsStackParamList, 'AgentTeamAddMember'>;

/** Add a specialist — web's `addMember` dialog. Agents already on the team
 * are filtered out: offering one would offer an addition the server
 * refuses as a duplicate. */
export function AddMemberScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const { data: team } = useGetAgentTeamQuery(params.teamId);
  const agentsQuery = useGetAvailableAgentsForChatQuery();
  const [addMember, { isLoading }] = useAddAgentTeamMemberMutation();

  const options = useMemo(() => {
    const onTeam = new Set((team?.specialists ?? []).map((m) => m.agentId));
    return (agentsQuery.data ?? []).filter((a) => !onTeam.has(a.id)).map((a) => ({ value: a.id, label: a.name }));
  }, [agentsQuery.data, team]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddMemberFormValues>({ resolver: yupResolver(addMemberSchema), defaultValues: { agentId: '' } });

  const onSubmit = async (values: AddMemberFormValues) => {
    try {
      await addMember({ teamId: params.teamId, agentId: values.agentId }).unwrap();
      toast.show(MEMBER_COPY.added, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not add that agent.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={MEMBER_COPY.addTitle} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{MEMBER_COPY.addDescription}</Text>
        <Card>
          {agentsQuery.isLoading ? (
            <Loader />
          ) : (
            <Controller
              control={control}
              name="agentId"
              render={({ field: { value, onChange } }) => (
                <PickerField
                  label="Agent *"
                  placeholder="Choose an agent"
                  value={value}
                  options={options}
                  onChange={onChange}
                  searchable
                  hint={agentsQuery.isError ? 'Agents could not be loaded — try again in a moment.' : options.length ? MEMBER_COPY.addHint : MEMBER_COPY.addHintNone}
                  error={errors.agentId?.message}
                />
              )}
            />
          )}
        </Card>
        <View style={styles.actions}>
          <Button label="Cancel" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} disabled={isLoading} />
          <Button label={MEMBER_COPY.addSubmit} onPress={handleSubmit(onSubmit)} loading={isLoading} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
