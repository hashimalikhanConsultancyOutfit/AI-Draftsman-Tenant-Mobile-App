/**
 * Connect a custom domain — ported from web's domain-connect half of
 * `useBranding.tsx`'s submit handler (confirmed against that source and
 * `AddDomainDto`/`DomainsController` on 2026-09-04). One field, only
 * reachable while the tenant has none yet — once a hostname exists it is
 * read-only everywhere (`DomainCard`), because it carries a verification
 * lifecycle and DNS records keyed on the value: renaming it in place
 * would either be silently ignored or taken as a new domain the backend
 * has never seen. Disconnect and add again is the only path back to
 * this screen once one is connected.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { BrandingStackParamList } from '@/navigation/types';
import { useAddDomainMutation } from './brandingApi';
import { CONNECT_SUCCESS_TOAST, DOMAIN_FORM_COPY } from './brandingRules';
import { domainFormSchema, type DomainFormValues } from './schemas/domainFormSchema';

type Nav = NativeStackNavigationProp<BrandingStackParamList>;

export function DomainFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const [addDomain, { isLoading: isSubmitting }] = useAddDomainMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DomainFormValues>({
    resolver: yupResolver(domainFormSchema) as never,
    defaultValues: { hostname: '' },
  });

  const onSubmit = async (values: DomainFormValues) => {
    try {
      const created = await addDomain({ hostname: values.hostname.trim() }).unwrap();
      toast.show(CONNECT_SUCCESS_TOAST(created.hostname), { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      /* 400/409 mean the tenant has to correct what they typed, so the
       * form must stay open with the value still in it — no navigation
       * back on failure, matching web's own `connect` contract. */
      toast.show(getErrorMessage(err as never, 'Could not connect that domain.'), { tone: 'error' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={DOMAIN_FORM_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{DOMAIN_FORM_COPY.description}</Text>

        <Card style={styles.section}>
          <Controller
            control={control}
            name="hostname"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField label={DOMAIN_FORM_COPY.fieldLabel} value={value} onChangeText={onChange} onBlur={onBlur} autoCapitalize="none" autoCorrect={false} placeholder="e.g. portal.northgate.ai" error={errors.hostname?.message} />
            )}
          />
        </Card>

        <Button label={DOMAIN_FORM_COPY.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 14 },
});
