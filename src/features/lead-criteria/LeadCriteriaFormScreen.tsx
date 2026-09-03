import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ComponentProps } from 'react';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, MultiSelectField, PickerField, Switch, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { LeadCriteriaStackParamList } from '@/navigation/types';
import { TagArrayField } from './components/TagArrayField';
import { useCreateLeadCriteriaSetMutation, useGetLeadCriteriaSetQuery, useUpdateLeadCriteriaSetMutation } from './leadCriteriaApi';
import { COMPANY_TYPE_OPTIONS, COUNTRY_OPTIONS, FUNDING_STAGE_OPTIONS, INDUSTRY_OPTIONS, REGION_OPTIONS, SENIORITY_OPTIONS, STATUS_OPTIONS } from './leadCriteriaOptions';
import { LEAD_CRITERIA_MODAL_COPY } from './leadCriteriaRules';
import { LEAD_CRITERIA_FORM_DEFAULTS, leadCriteriaSchema, toFormValues, toLeadCriteriaRequest, type LeadCriteriaFormValues } from './schemas/leadCriteriaFormSchema';

type Nav = NativeStackNavigationProp<LeadCriteriaStackParamList>;
type Rt = RouteProp<LeadCriteriaStackParamList, 'LeadCriteriaForm'>;

function SectionHeading({ icon, children }: { icon: ComponentProps<typeof Icon>['name']; children: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionHeading}>
      <Icon name={icon} size={16} color={theme.colors.accent} />
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{children}</Text>
    </View>
  );
}

/**
 * Create + Edit lead-criteria set — one shared screen, 6 sections
 * (Identity, Firmographics, Contact targeting, Keywords & exclusions,
 * Signals & intent, Thresholds), ported field-for-field from web's
 * `LeadCriteriaFormDialog.tsx`. Built as one scrollable form with clear
 * section headers rather than a literal paged wizard — matching this
 * app's other multi-section forms (e.g. `ChatThreadDetailsScreen`) — so
 * every field stays reachable in one pass without a stepper component
 * this codebase does not have yet.
 */
export function LeadCriteriaFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const isEdit = Boolean(params?.id);
  const copy = isEdit ? LEAD_CRITERIA_MODAL_COPY.edit : LEAD_CRITERIA_MODAL_COPY.create;

  const { data: editingSet, isLoading: isLoadingSet, error: loadError } = useGetLeadCriteriaSetQuery(params?.id ?? '', { skip: !isEdit });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadCriteriaFormValues>({
    resolver: yupResolver(leadCriteriaSchema) as never,
    defaultValues: LEAD_CRITERIA_FORM_DEFAULTS,
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isEdit || !editingSet) return;
    reset(toFormValues(editingSet));
    setHydrated(true);
  }, [editingSet, hydrated, isEdit, reset]);

  const [createSet, { isLoading: isCreating }] = useCreateLeadCriteriaSetMutation();
  const [updateSet, { isLoading: isUpdating }] = useUpdateLeadCriteriaSetMutation();
  const isSubmitting = isCreating || isUpdating;

  const onSubmit = async (values: LeadCriteriaFormValues) => {
    try {
      const body = toLeadCriteriaRequest(values, isEdit ? 'edit' : 'create');
      if (isEdit && editingSet) {
        await updateSet({ id: editingSet.id, ...body }).unwrap();
      } else {
        await createSet(body).unwrap();
      }
      toast.show(`“${values.name.trim()}” ${isEdit ? 'saved' : 'created'}.`, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, `Could not ${isEdit ? 'save' : 'create'} that set.`), { tone: 'error' });
    }
  };

  if (isEdit && isLoadingSet) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (isEdit && (loadError || !editingSet)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This lead-criteria set no longer exists." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={copy.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        {/* --- Identity ------------------------------------------------- */}
        <Card style={styles.section}>
          <SectionHeading icon="badge">Identity</SectionHeading>
          <Controller control={control} name="name" render={({ field: { value, onChange, onBlur } }) => (
            <TextField label="Name" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Mid-market SaaS, UK & Ireland" error={errors.name?.message} />
          )} />
          <Controller control={control} name="description" render={({ field: { value, onChange, onBlur } }) => (
            <TextField label="Description" value={value} onChangeText={onChange} onBlur={onBlur} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} placeholder="What this set is looking for, and why." />
          )} />
          {isEdit && (
            <Controller control={control} name="status" render={({ field: { value, onChange } }) => (
              <PickerField label="Status" value={value} options={STATUS_OPTIONS} onChange={(v) => onChange(v as LeadCriteriaFormValues['status'])} />
            )} />
          )}
        </Card>

        {/* --- Firmographics ---------------------------------------------- */}
        <Card style={styles.section}>
          <SectionHeading icon="apartment">Firmographics</SectionHeading>
          <Controller control={control} name="industries" render={({ field: { value, onChange } }) => (
            <MultiSelectField label="Industries" values={value} options={INDUSTRY_OPTIONS} onChange={onChange} />
          )} />
          <Controller control={control} name="countries" render={({ field: { value, onChange } }) => (
            <MultiSelectField label="Countries" values={value} options={COUNTRY_OPTIONS} onChange={onChange} />
          )} />
          <Controller control={control} name="regions" render={({ field: { value, onChange } }) => (
            <MultiSelectField label="Regions" values={value} options={REGION_OPTIONS} onChange={onChange} />
          )} />
          <Controller control={control} name="companyTypes" render={({ field: { value, onChange } }) => (
            <MultiSelectField label="Company types" values={value} options={COMPANY_TYPE_OPTIONS} onChange={onChange} />
          )} />
          <View style={styles.fieldPair}>
            <View style={{ flex: 1 }}>
              <Controller control={control} name="employeeCountMin" render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Min employees" value={String(value)} onChangeText={(t) => onChange(t === '' ? '' : Number(t.replace(/[^0-9]/g, '')))} onBlur={onBlur} keyboardType="number-pad" error={errors.employeeCountMin?.message} />
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller control={control} name="employeeCountMax" render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Max employees" value={String(value)} onChangeText={(t) => onChange(t === '' ? '' : Number(t.replace(/[^0-9]/g, '')))} onBlur={onBlur} keyboardType="number-pad" error={errors.employeeCountMax?.message} />
              )} />
            </View>
          </View>
          <View style={styles.fieldPair}>
            <View style={{ flex: 1 }}>
              <Controller control={control} name="annualRevenueMin" render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Min annual revenue" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" placeholder="1000000" error={errors.annualRevenueMin?.message} />
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller control={control} name="annualRevenueMax" render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Max annual revenue" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" placeholder="5000000" error={errors.annualRevenueMax?.message} />
              )} />
            </View>
          </View>
          <Controller control={control} name="revenueCurrency" render={({ field: { value, onChange, onBlur } }) => (
            <TextField label="Currency" value={value} onChangeText={(t) => onChange(t.toUpperCase())} onBlur={onBlur} autoCapitalize="characters" maxLength={3} placeholder="GBP" error={errors.revenueCurrency?.message} />
          )} />
        </Card>

        {/* --- Contact targeting -------------------------------------------- */}
        <Card style={styles.section}>
          <SectionHeading icon="contact-page">Contact targeting</SectionHeading>
          <Controller control={control} name="jobTitles" render={({ field: { value, onChange } }) => (
            <TagArrayField label="Job titles" values={value} onChange={onChange} placeholder="Add a job title" />
          )} />
          <Controller control={control} name="seniorities" render={({ field: { value, onChange } }) => (
            <MultiSelectField label="Seniorities" values={value} options={SENIORITY_OPTIONS} onChange={onChange} searchable={false} />
          )} />
          <Controller control={control} name="departments" render={({ field: { value, onChange } }) => (
            <TagArrayField label="Departments" values={value} onChange={onChange} placeholder="Add a department" />
          )} />
        </Card>

        {/* --- Keywords & exclusions ------------------------------------- */}
        <Card style={styles.section}>
          <SectionHeading icon="label">Keywords & exclusions</SectionHeading>
          <Controller control={control} name="includeKeywords" render={({ field: { value, onChange } }) => (
            <TagArrayField label="Include keywords" values={value} onChange={onChange} placeholder="Add a keyword to look for" />
          )} />
          <Controller control={control} name="excludeKeywords" render={({ field: { value, onChange } }) => (
            <TagArrayField label="Exclude keywords" values={value} onChange={onChange} placeholder="Add a keyword to rule out" />
          )} />
          <Controller control={control} name="excludeDomains" render={({ field: { value, onChange } }) => (
            <TagArrayField label="Exclude domains" values={value} onChange={onChange} placeholder="Add a domain to rule out" />
          )} />
          <Controller control={control} name="technologies" render={({ field: { value, onChange } }) => (
            <TagArrayField label="Technologies" values={value} onChange={onChange} placeholder="Add a technology" />
          )} />
        </Card>

        {/* --- Signals & intent -------------------------------------------- */}
        <Card style={styles.section}>
          <SectionHeading icon="sensors">Signals & intent</SectionHeading>
          <Controller control={control} name="fundingStages" render={({ field: { value, onChange } }) => (
            <MultiSelectField label="Funding stages" values={value} options={FUNDING_STAGE_OPTIONS} onChange={onChange} searchable={false} />
          )} />
          <View style={styles.fieldPair}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Controller control={control} name="hiringSignal" render={({ field: { value, onChange } }) => (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>Hiring signal</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>Looking for companies actively hiring.</Text>
                  </View>
                  <Switch value={value} onValueChange={onChange} />
                </View>
              )} />
            </View>
          </View>
          <Controller control={control} name="recentFundingWithinDays" render={({ field: { value, onChange, onBlur } }) => (
            <TextField label="Recent funding within, days" value={String(value)} onChangeText={(t) => onChange(t === '' ? '' : Number(t.replace(/[^0-9]/g, '')))} onBlur={onBlur} keyboardType="number-pad" placeholder="90" error={errors.recentFundingWithinDays?.message} />
          )} />
          <Controller control={control} name="sources" render={({ field: { value, onChange } }) => (
            <TagArrayField label="Sources" values={value} onChange={onChange} placeholder="Add a source" hint="Free text — describes what you're looking FOR, not where a lead has already come from." />
          )} />
        </Card>

        {/* --- Thresholds -------------------------------------------------- */}
        <Card style={styles.section}>
          <SectionHeading icon="tune">Thresholds</SectionHeading>
          <View style={styles.fieldPair}>
            <View style={{ flex: 1 }}>
              <Controller control={control} name="minScore" render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Minimum score" value={String(value)} onChangeText={(t) => onChange(t === '' ? '' : Number(t.replace(/[^0-9]/g, '')))} onBlur={onBlur} keyboardType="number-pad" hint="0-100. A future scorer's floor." error={errors.minScore?.message} />
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller control={control} name="autoQualifyScore" render={({ field: { value, onChange, onBlur } }) => (
                <TextField label="Auto-qualify score" value={String(value)} onChangeText={(t) => onChange(t === '' ? '' : Number(t.replace(/[^0-9]/g, '')))} onBlur={onBlur} keyboardType="number-pad" hint="0-100, optional." error={errors.autoQualifyScore?.message} />
              )} />
            </View>
          </View>
        </Card>

        <Button label={copy.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  section: { gap: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  fieldPair: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
