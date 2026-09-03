import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { ChatAttachment } from '../chat.types';
import { formatDuration, formatFileSize } from '../chatRules';
import { useLazyGetAttachmentUrlQuery } from '../chatApi';

interface AttachmentTileProps {
  attachment: ChatAttachment;
  /** True inside a user (accent) bubble — flips the file-chip tint. */
  dark: boolean;
}

/**
 * One attachment on a received or sent message. URLs expire in ~120
 * seconds, so the mint always happens at the moment of use — never cached
 * beyond this tile's own local state.
 *
 * PHOTO renders inline via `expo-image` (already a dependency) and opens a
 * full-screen lightbox on tap, mirroring the web's `Dialog maxWidth="lg"`.
 * VIDEO and FILE render as a chip that mints its URL on tap and hands off
 * to the OS's own player / viewer via `Linking.openURL` — there is no
 * in-app video-playback library in this app yet (`expo-av` is not
 * installed, and adding a native module mid-phase means a new dev-client
 * build), so inline playback is deferred rather than adding an unreviewed
 * dependency. VOICE gets the same chip treatment with a waveform glyph and
 * its recorded duration.
 *
 * `UNSCANNED` scan verdict renders as nothing at all — deliberately not a
 * badge, matching the web exactly: claiming a scan happened would be worse
 * than saying nothing.
 */
export function AttachmentTile({ attachment, dark }: AttachmentTileProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [fetchUrl, { isFetching }] = useLazyGetAttachmentUrlQuery();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const mintAndUse = async (use: (url: string) => void) => {
    setFailed(false);
    try {
      const result = await fetchUrl(attachment.id).unwrap();
      use(result.url);
    } catch {
      setFailed(true);
    }
  };

  if (attachment.kind === 'PHOTO') {
    return (
      <>
        <TouchableOpacity
          onPress={() =>
            imageUrl ? setLightboxOpen(true) : mintAndUse((url) => { setImageUrl(url); setLightboxOpen(true); })
          }
          style={[styles.mediaTile, { borderRadius: 14, backgroundColor: theme.colors.background }]}
          accessibilityRole="button"
          accessibilityLabel={failed ? `Tap to retry loading ${attachment.filename}` : `Open ${attachment.filename}`}
        >
          {isFetching && <ActivityIndicator color={theme.colors.accent} />}
          {!isFetching && failed && (
            <View style={styles.centered}>
              <Icon name="refresh" size={20} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Tap to retry</Text>
            </View>
          )}
          {!isFetching && !failed && imageUrl && (
            <Image
              source={{ uri: imageUrl }}
              style={styles.mediaFill}
              contentFit="cover"
              onError={() => setFailed(true)}
            />
          )}
          {!isFetching && !failed && !imageUrl && <Icon name="image" size={28} color={theme.colors.textMuted} />}
        </TouchableOpacity>

        <Modal visible={lightboxOpen} transparent animationType="fade" onRequestClose={() => setLightboxOpen(false)}>
          <TouchableOpacity
            style={[styles.lightboxScrim, { paddingTop: insets.top }]}
            activeOpacity={1}
            onPress={() => setLightboxOpen(false)}
          >
            {imageUrl && <Image source={{ uri: imageUrl }} style={styles.lightboxImage} contentFit="contain" />}
            <TouchableOpacity
              style={[styles.lightboxClose, { top: insets.top + 12 }]}
              onPress={() => setLightboxOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  // VIDEO, FILE and VOICE: a chip, colour-coded by kind, minting its URL on
  // tap and handing off to the OS. Failure is worded to match the web's own
  // signed-URL contract underneath.
  const chipTint = dark ? theme.colors.textOnAccent : theme.colors.text;
  const iconName = attachment.kind === 'VIDEO' ? 'videocam' : attachment.kind === 'VOICE' ? 'graphic-eq' : 'insert-drive-file';
  return (
    <TouchableOpacity
      onPress={() => mintAndUse((url) => Linking.openURL(url).catch(() => setFailed(true)))}
      disabled={isFetching}
      style={[
        styles.fileChip,
        { backgroundColor: dark ? 'rgba(0,0,0,0.18)' : theme.colors.background, borderRadius: theme.radii.md },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${attachment.filename}`}
    >
      <View
        style={[styles.fileIcon, { backgroundColor: dark ? 'rgba(255,255,255,0.18)' : theme.colors.accent + '1A' }]}
      >
        {isFetching ? (
          <ActivityIndicator size="small" color={chipTint} />
        ) : (
          <Icon name={iconName} size={18} color={chipTint} />
        )}
      </View>
      <View style={styles.fileMeta}>
        <Text numberOfLines={1} style={{ color: chipTint, fontFamily: theme.fontFamilies.body.medium, fontSize: 13 }}>
          {attachment.filename}
        </Text>
        <Text style={{ color: chipTint, opacity: 0.7, fontSize: 11 }}>
          {failed
            ? 'Could not open — tap to retry'
            : attachment.kind === 'VOICE' && attachment.durationSec !== null
              ? formatDuration(attachment.durationSec)
              : formatFileSize(attachment.sizeBytes)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mediaTile: { width: 180, aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mediaFill: { width: '100%', height: '100%' },
  centered: { alignItems: 'center', gap: 4 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  fileIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fileMeta: { flex: 1, minWidth: 0 },
  lightboxScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxClose: { position: 'absolute', right: 16, padding: 8 },
});
