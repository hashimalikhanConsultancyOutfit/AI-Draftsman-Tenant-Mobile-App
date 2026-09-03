import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Icon, Loader, PickerField, Switch, TextField, useToast } from '@/components/ui';
import { LEAD_CRITERIA_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { LeadCriteriaStackParamList } from '@/navigation/types';
import { useAddEvaluationCriterionMutation, useGetLeadCriteriaSetQuery, useRemoveEvaluationCriterionMutation, useUpdateEvaluationCriterionMutation } from './leadCriteriaApi';
import { EVALUATION_FIELD_OPTIONS, EVALUATION_OPERATOR_OPTIONS, EVALUATION_RULE_MODAL_COPY, EVALUATION_WEIGHT_MAX, EVALUATION_WEIGHT_MIN, NO_PERMISSION_MESSAGE, buildRuleRows, type RuleRow } from './leadCriteriaRules';
import { evaluationRuleSchema, type EvaluationRuleFormValues } from './schemas/evaluationRuleSchema';
import type { EvaluationCriterion, LeadEvaluationField, LeadEvaluationOperator } from './leadCriteria.types';

type Nav = NativeStackNavigationProp<LeadCriteriaStackParamList>;
type Rt = RouteProp<LeadCriteriaStackParamList, 'LeadCriteriaRules'>;

const RULE_DEFAULTS: EvaluationRuleFormValues = { field: 'INDUSTRY', operator: 'EQUALS', value: '', label: '', weight: '0', required: false };

export function LeadCriteriaRulesScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canEdit = usePermission(LEAD_CRITERIA_PERMISSIONS.MANAGE);

  const { data: set, isFetching: isLoading, error, refetch } = useGetLeadCriteriaSetQuery(params.id);
  const [addRule, { isLoading: isAdding }] = useAddEvaluationCriterionMutation();
  const [updateRule, { isLoading: isUpdatingRule }] = useUpdateEvaluationCriterionMutation();
  const [removeRule, { isLoading: isRemoving }] = useRemoveEvaluationCriterionMutation();

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [targetRuleId, setTargetRuleId] = useState<string | null>(null);

  const rules = set?.evaluationCriteria ?? [];
  const ruleRows = buildRuleRows(rules);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EvaluationRuleFormValues>({
    resolver: yupResolver(evaluationRuleSchema) as never,
    defaultValues: RULE_DEFAULTS,
  });
  const operatorValue = watch('operator');

  const openAdd = () => {
    if (!canEdit) {
      toast.show(NO_PERMISSION_MESSAGE, { tone: 'warning' });
      return;
    }
    reset(RULE_DEFAULTS);
    setTargetRuleId(null);
    setModal('add');
  };

  const openEdit = (rule: EvaluationCriterion) => {
    if (!canEdit) {
      toast.show(NO_PERMISSION_MESSAGE, { tone: 'warning' });
      return;
    }
    reset({ field: rule.field, operator: rule.operator, value: rule.value, label: rule.label, weight: String(rule.weight), required: rule.required });
    setTargetRuleId(rule.id);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setTargetRuleId(null);
  };

  const onSubmit = async (values: EvaluationRuleFormValues) => {
    const weight = values.weight.trim() === '' ? 0 : Number(values.weight);
    const body = { field: values.field as LeadEvaluationField, operator: values.operator as LeadEvaluationOperator, value: values.value, label: values.label.trim(), weight, required: values.required };
    try {
      if (modal === 'add') {
        await addRule({ leadCriteriaId: params.id, ...body }).unwrap();
        toast.show('Rule added.', { tone: 'success' });
      } else if (modal === 'edit' && targetRuleId) {
        await updateRule({ leadCriteriaId: params.id, criterionId: targetRuleId, ...body }).unwrap();
        toast.show('Rule saved.', { tone: 'success' });
      }
      closeModal();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not save that rule.'), { tone: 'error' });
    }
  };

  const handleRemove = (row: RuleRow) => {
    if (!canEdit) {
      toast.show(NO_PERMISSION_MESSAGE, { tone: 'warning' });
      return;
    }
    Alert.alert('Remove this rule?', `“${row.label}” will be removed. You can add it again in seconds.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeRule({ leadCriteriaId: params.id, criterionId: row.id }).unwrap();
            toast.show('Rule removed.', { tone: 'neutral' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not remove that rule.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  if (isLoading && !set) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Evaluation rules" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !set) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Evaluation rules" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This lead-criteria set no longer exists." onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={set.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        {canEdit && <Button label="Add rule" icon="add" onPress={openAdd} fullWidth />}

        {ruleRows.length === 0 ? (
          <EmptyState icon="rule" title="No evaluation rules yet" description="Rules explain why a lead matching this set would be scored the way it would be." />
        ) : (
          <View style={{ gap: 10 }}>
            {ruleRows.map((row) => (
              <Card key={row.id} style={{ gap: 6 }}>
                <View style={styles.ruleTop}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, flex: 1 }}>{row.label}</Text>
                  <View style={[styles.weightChip, { backgroundColor: row.weight >= 0 ? theme.colors.statusSuccessBg : theme.colors.statusErrorBg, borderRadius: theme.radii.full }]}>
                    <Text style={{ color: row.weight >= 0 ? theme.colors.statusSuccessFg : theme.colors.statusErrorFg, fontSize: 11, fontFamily: theme.fontFamilies.body.semibold }}>{row.weight >= 0 ? `+${row.weight}` : row.weight}</Text>
                  </View>
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {row.fieldLabel} {row.operatorLabel.toLowerCase()} {row.value ? `“${row.value}”` : ''}
                  {row.required ? ' · required' : ''}
                </Text>
                {canEdit && (
                  <View style={styles.ruleActions}>
                    <TouchableOpacity onPress={() => openEdit(rules.find((r) => r.id === row.id)!)} style={styles.actionBtn}>
                      <Icon name="edit" size={15} color={theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemove(row)} style={styles.actionBtn}>
                      <Icon name="delete" size={15} color={theme.colors.error} />
                      <Text style={{ color: theme.colors.error, fontSize: 12 }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={modal !== null} animationType="slide" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <AppHeader title={modal ? EVALUATION_RULE_MODAL_COPY[modal].title : ''} mode="stack" onBack={closeModal} />
          <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
            <Controller control={control} name="field" render={({ field: { value, onChange } }) => (
              <PickerField label="Field" value={value} options={EVALUATION_FIELD_OPTIONS} onChange={(v) => onChange(v as LeadEvaluationField)} />
            )} />
            <Controller control={control} name="operator" render={({ field: { value, onChange } }) => (
              <PickerField label="Operator" value={value} options={EVALUATION_OPERATOR_OPTIONS} onChange={(v) => onChange(v as LeadEvaluationOperator)} />
            )} />
            {operatorValue !== 'EXISTS' && (
              <Controller control={control} name="value" render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Value" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. Healthcare, or 10,50 for Between" hint="For Between, use two comma-separated numbers, e.g. &quot;10,50&quot;." />
              )} />
            )}
            <Controller control={control} name="label" render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Label" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Healthcare is our strongest vertical" multiline numberOfLines={2} error={errors.label?.message} />
            )} />
            <Controller control={control} name="weight" render={({ field: { value, onChange, onBlur } }) => (
              <TextField label="Weight" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="numbers-and-punctuation" hint={`${EVALUATION_WEIGHT_MIN} to ${EVALUATION_WEIGHT_MAX} — how much this rule is worth toward a future score.`} error={errors.weight?.message} />
            )} />
            <Controller control={control} name="required" render={({ field: { value, onChange } }) => (
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>Required</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>A failed required rule disqualifies rather than only deducting points.</Text>
                </View>
                <Switch value={value} onValueChange={onChange} />
              </View>
            )} />
            <Button label={modal ? EVALUATION_RULE_MODAL_COPY[modal].submitLabel : 'Save'} onPress={handleSubmit(onSubmit)} loading={isAdding || isUpdatingRule} fullWidth />
          </ScrollView>
        </View>
      </Modal>
      {isRemoving && <Loader />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  ruleTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weightChip: { paddingHorizontal: 8, paddingVertical: 3 },
  ruleActions: { flexDirection: 'row', gap: 18, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
