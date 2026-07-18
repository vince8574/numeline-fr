import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';

// Consentement EXPLICITE au traitement des données de santé (art. 9 RGPD),
// recueilli de façon DISTINCTE avant toute saisie d'allergène/grossesse/régime.
// Affiché au 1er ajout de profil (ou pour un profil migré sans consentement).
// « Refuser » n'enregistre rien ; « J'accepte » horodate le consentement.

export function HealthConsentModal({
  visible,
  onAccept,
  onDecline
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="shield-checkmark" size={30} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('consent.title')}</Text>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={{ gap: 10 }}>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{t('consent.intro')}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{t('consent.purpose')}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{t('consent.rights')}</Text>
            <TouchableOpacity onPress={() => router.push('/legal/privacy-policy' as any)}>
              <Text style={[styles.link, { color: colors.accent }]}>{t('consent.readPolicy')}</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: colors.accent }]}
            onPress={onAccept}
            accessibilityRole="button"
          >
            <Text style={[styles.acceptText, { color: colors.onAccent }]}>{t('consent.accept')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={onDecline} accessibilityRole="button">
            <Text style={[styles.declineText, { color: colors.textSecondary }]}>{t('consent.decline')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 14
  },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  bodyScroll: { maxHeight: 260, width: '100%' },
  body: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline', marginTop: 2 },
  acceptBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4
  },
  acceptText: { fontSize: 16, fontWeight: '800' },
  declineBtn: { paddingVertical: 8 },
  declineText: { fontSize: 14, fontWeight: '600' }
});
