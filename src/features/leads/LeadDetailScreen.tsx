import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { LEAD_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { LeadsStackParamList } from '@/navigation/types';
import { useDeleteLeadAttachmentMutation, useDeleteLeadMutation, useGetLeadAttachmentUrlMutation, useGetLeadAttachmentsQuery, useGetLeadQuery } from './leadsApi';
import { buildAttachmentDeleteWarning, buildLeadDeleteWarning, buildLeadDetailRows, pluraliseFiles } from './leadsRules';
import type { StatusTone } from './leads.types';

type Nav = NativeStackNavigationProp<LeadsStackParamList>;
type Rt = RouteProp<LeadsStackParamList, 'LeadDetail'>;

function toneColors(theme: ReturnType<typeof useAppTheme>['theme'], tone?: StatusTone) {
  if (tone === 'success') return { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg };
  if (tone === 'danger') return { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg };
  if (tone === 'warning') return { bg: theme.colors.statusWarningBg, fg: theme.colors.statusWarningFg };
  if (tone === 'accent') return { bg: theme.colors.accent + '1A', fg: theme.colors.accent };
  if (tone === 'info' || tone === 'purple') return { bg: theme.colors.accent + '1A', fg: theme.colors.accent };
  return { bg: theme.colors.statusNeutralBg, fg: theme.colors.textMuted };
}

export function LeadDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canUpdate = usePermission(LEAD_PERMISSIONS.UPDATE);
  const canDelete = usePermission(LEAD_PERMISSIONS.DELETE);

  const { data: lead, isLoading, error, refetch } = useGetLeadQuery(params.id);
  const attachmentsQuery = useGetLeadAttachmentsQuery(params.id);
  const [getAttachmentUrl] = useGetLeadAttachmentUrlMutation();
  const [deleteAttachment, { isLoading: isRemovingAttachment }] = useDeleteLeadAttachmentMutation();
  const [deleteLead, { isLoading: isDeleting }] = useDeleteLeadMutation();

  const [openingId, setOpeningId] = useState<string | null>(null);

  const rows = buildLeadDetailRows(lead ?? null);

  const handleOpenAttachment = async (attachmentId: string) => {
    setOpeningId(attachmentId);
    try {
      const { url } = await getAttachmentUrl({ leadId: params.id, attachmentId }).unwrap();
      await Linking.openURL(url);
    } catch {
      toast.show('Could not open that file.', { tone: 'error' });
    } finally {
      setOpeningId(null);
    }
  };

  const handleRemoveAttachment = (attachmentId: string, fileName: string) => {
    if (!canUpdate) return;
    Alert.alert('Remove file?', buildAttachmentDeleteWarning(fileName), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAttachment({ leadId: params.id, attachmentId }).unwrap();
            toast.show('File removed.', { tone: 'neutral' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not remove that file.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!lead || !canDelete) return;
    Alert.alert('Delete lead?', buildLeadDeleteWarning(lead.name), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLead(lead.id).unwrap();
            toast.show(`${lead.name} deleted.`, { tone: 'neutral' });
            navigation.goBack();
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not delete that lead.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Lead" mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !lead) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="Lead" mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message="This lead no longer exists." onRetry={refetch} />
      </View>
    );
  }

  const attachments = attachmentsQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={lead.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Card style={{ gap: 10 }}>
          {rows.map((row) => {
            const tone = toneColors(theme, row.tone);
            return (
              <View key={row.id} style={styles.fieldRow}>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{row.label}</Text>
                {row.tone ? (
                  <View style={[styles.chip, { backgroundColor: tone.bg, borderRadius: theme.radii.full }]}>
                    <Text style={{ color: tone.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>{row.value}</Text>
                  </View>
                ) : (
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{row.value}</Text>
                )}
              </View>
            );
          })}
        </Card>

        {lead.description ? (
          <Card>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.4, marginBottom: 6 }}>DESCRIPTION</Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{lead.description}</Text>
          </Card>
        ) : null}

        <Card>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.4, marginBottom: 6 }}>WHY IT SCORED THAT WAY</Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
            {lead.why || 'No justification recorded for this score.'}
          </Text>
        </Card>

        <Card>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11, letterSpacing: 0.4, marginBottom: 10 }}>
            ATTACHMENTS {attachments.length > 0 ? `(${pluraliseFiles(attachments.length)})` : ''}
          </Text>
          {attachmentsQuery.isLoading ? (
            <Loader />
          ) : attachments.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>Nothing is attached to this lead yet.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {attachments.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => handleOpenAttachment(a.id)}
                  disabled={openingId === a.id}
                  style={[styles.attachmentRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
                >
                  <Icon name="insert-drive-file" size={18} color={theme.colors.textMuted} />
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                    {a.fileName}
                  </Text>
                  {canUpdate && (
                    <TouchableOpacity onPress={() => handleRemoveAttachment(a.id, a.fileName)} disabled={isRemovingAttachment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="close" size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {canUpdate && (
          <Button label="Edit lead" icon="edit" variant="outline" onPress={() => navigation.navigate('LeadForm', { id: lead.id })} fullWidth />
        )}
        {canDelete && <Button label="Delete lead" icon="delete" variant="danger" onPress={handleDelete} loading={isDeleting} fullWidth />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { paddingHorizontal: 10, paddingVertical: 3 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
});
