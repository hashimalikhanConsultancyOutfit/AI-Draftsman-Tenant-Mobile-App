/**
 * Edit brand — logo, palette, font, powered-by badge. Ported from web's
 * `BRAND_FIELDS` + its submit handler in `useBranding.tsx` (confirmed
 * against that source and `UpdateBrandingDto`/`BrandingController` on
 * 2026-09-04): one multipart `PATCH /branding` carrying the colours as a
 * `palette` JSON string, the font label, the badge boolean, and — only
 * when the user picked a new one — the logo file. Leaving the logo picker
 * untouched keeps the current logo; there is no "remove logo" action on
 * either platform.
 *
 * The white-label "level" web uses to lock this badge on at tier 1 has no
 * gateway-b2b equivalent reachable from here (see `branding.types.ts`'s
 * module doc) — the toggle is freely editable under `branding.manage`
 * alone, matching exactly what `PATCH /branding` itself enforces.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, PickerField, Switch, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { BrandingStackParamList } from '@/navigation/types';
import { useGetBrandingQuery, useUpdateBrandingMutation } from './brandingApi';
import { BRAND_FORM_COPY, FONT_OPTIONS, LOGO_ALLOWED_MIME, LOGO_MAX_BYTES, LOGO_TOO_LARGE_MESSAGE, LOGO_WRONG_TYPE_MESSAGE, SAVED_BRAND_TOAST } from './brandingRules';
import { brandFormSchema, type BrandFormValues } from './schemas/brandFormSchema';

type Nav = NativeStackNavigationProp<BrandingStackParamList>;

interface PickedLogo {
  uri: string;
  name: string;
  type: string;
}

export function BrandFormScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const { data: brandTheme, isSuccess } = useGetBrandingQuery();
  const [updateBranding, { isLoading: isSubmitting }] = useUpdateBrandingMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrandFormValues>({
    resolver: yupResolver(brandFormSchema) as never,
    defaultValues: { primary: '#0A5E49', accent: '#C8622A', font: 'Inter', powered: true },
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !isSuccess || !brandTheme) return;
    reset({ primary: brandTheme.palette.primary, accent: brandTheme.palette.accent, font: brandTheme.typography, powered: brandTheme.powered });
    setHydrated(true);
  }, [hydrated, isSuccess, reset, brandTheme]);

  const [pickedLogo, setPickedLogo] = useState<PickedLogo | null>(null);

  const handlePickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    if (!LOGO_ALLOWED_MIME.includes(mimeType)) {
      toast.show(LOGO_WRONG_TYPE_MESSAGE, { tone: 'warning' });
      return;
    }
    if (asset.fileSize && asset.fileSize > LOGO_MAX_BYTES) {
      toast.show(LOGO_TOO_LARGE_MESSAGE, { tone: 'warning' });
      return;
    }
    setPickedLogo({ uri: asset.uri, name: asset.fileName ?? `logo-${Date.now()}.png`, type: mimeType });
  };

  const onSubmit = async (values: BrandFormValues) => {
    const form = new FormData();
    form.append('palette', JSON.stringify({ primary: values.primary.trim(), accent: values.accent.trim() }));
    form.append('typography', values.font);
    form.append('powered', values.powered ? 'true' : 'false');
    if (pickedLogo) {
      form.append('file', { uri: pickedLogo.uri, name: pickedLogo.name, type: pickedLogo.type } as unknown as Blob);
    }
    try {
      await updateBranding(form).unwrap();
      toast.show(SAVED_BRAND_TOAST, { tone: 'success' });
      navigation.goBack();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not save that brand.'), { tone: 'error' });
    }
  };

  const logoPreviewUri = pickedLogo?.uri ?? brandTheme?.logo ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={BRAND_FORM_COPY.title} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{BRAND_FORM_COPY.description}</Text>

        <Card style={styles.section}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>Logo</Text>
          <View style={styles.logoRow}>
            {logoPreviewUri ? (
              <Image source={{ uri: logoPreviewUri }} style={[styles.logoPreview, { borderColor: theme.colors.border }]} resizeMode="contain" />
            ) : (
              <View style={[styles.logoPreview, styles.logoPlaceholder, { borderColor: theme.colors.border, backgroundColor: theme.colors.statusNeutralBg }]} />
            )}
            <Button label={pickedLogo ? 'Choose a different file' : 'Choose logo'} size="sm" variant="outline" icon="image" onPress={handlePickLogo} />
          </View>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>PNG, JPEG or WebP, up to 2 MB. Leave unchanged to keep the current logo.</Text>
        </Card>

        <Card style={styles.section}>
          <Controller
            control={control}
            name="primary"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.colorRow}>
                <View style={[styles.swatch, { backgroundColor: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value) ? value : theme.colors.statusNeutralBg, borderColor: theme.colors.border }]} />
                <View style={{ flex: 1 }}>
                  <TextField label="Primary colour" value={value} onChangeText={onChange} onBlur={onBlur} autoCapitalize="none" placeholder="#0A5E49" error={errors.primary?.message} />
                </View>
              </View>
            )}
          />
          <Controller
            control={control}
            name="accent"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.colorRow}>
                <View style={[styles.swatch, { backgroundColor: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value) ? value : theme.colors.statusNeutralBg, borderColor: theme.colors.border }]} />
                <View style={{ flex: 1 }}>
                  <TextField label="Accent colour" value={value} onChangeText={onChange} onBlur={onBlur} autoCapitalize="none" placeholder="#C8622A" error={errors.accent?.message} />
                </View>
              </View>
            )}
          />
          <Controller control={control} name="font" render={({ field: { value, onChange } }) => <PickerField label="Font" value={value} options={FONT_OPTIONS} onChange={onChange} error={errors.font?.message} />} />
        </Card>

        <Card style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }}>Show "Powered by AiDraftsman"</Text>
            <Controller control={control} name="powered" render={({ field: { value, onChange } }) => <Switch value={value} onValueChange={onChange} accessibilityLabel="Show Powered by AiDraftsman" />} />
          </View>
        </Card>

        <Button label={BRAND_FORM_COPY.submitLabel} onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoPreview: { width: 56, height: 56, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  logoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
