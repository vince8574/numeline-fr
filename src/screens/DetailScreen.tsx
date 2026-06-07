import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { useQuery } from '@tanstack/react-query';
import { fetchAllRecalls } from '../services/apiService';
import { RecallAlert } from '../components/RecallAlert';
import { extractRecallReason } from '../utils/recallUtils';
import { GradientBackground } from '../components/GradientBackground';
import { useVoiceGuide } from '../hooks/useVoiceGuide';
import { isKnownBrand } from '../utils/lotMatcher';

export function DetailScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, removeProduct, updateProduct } = useScannedProducts();
  const { data: recalls } = useQuery({
    queryKey: ['recalls'],
    queryFn: fetchAllRecalls
  });
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [editedBrand, setEditedBrand] = useState('');

  const product = useMemo(() => products.find((item) => item.id === id), [id, products]);
  const recall = useMemo(
    () => recalls?.find((item) => item.id === product?.recallReference),
    [product?.recallReference, recalls]
  );
  const recallReason = useMemo(() => recall ? extractRecallReason(recall) : undefined, [recall]);
  const isRecalled = product?.recallStatus === 'recalled';

  // Mode malvoyant : annonce vocale du verdict à l'arrivée sur l'écran de résultat.
  // C'est le point d'aboutissement du parcours mains-libres (code-barres → lot →
  // résultat). On n'annonce qu'une fois (ref de garde).
  const { speak, enabled: voiceEnabled } = useVoiceGuide();
  const verdictAnnouncedRef = useRef(false);
  useEffect(() => {
    if (!voiceEnabled || !product || verdictAnnouncedRef.current) return;
    verdictAnnouncedRef.current = true;
    const msg =
      product.recallStatus === 'recalled'
        ? t('accessibility.voice.recallDetected')
        : t('accessibility.voice.productSafe');
    speak(msg, { priority: true });
  }, [voiceEnabled, product, speak, t]);

  if (!product) {
    return (
      <GradientBackground>
        <Text style={[styles.missingText, { color: colors.textSecondary }]}>
          {t('details.notFound')}
        </Text>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Alerte de rappel en haut si le produit est contaminé */}
        {isRecalled && recall && (
          <View style={styles.section}>
            <RecallAlert recall={recall} reason={recallReason} />
          </View>
        )}

        <View style={styles.section}>
          <View style={[styles.infoBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('details.privacyInfo')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {isEditingBrand ? (
              <View style={styles.brandEditContainer}>
                <TextInput
                  style={[styles.brandInput, { color: colors.textPrimary, borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]}
                  value={editedBrand}
                  onChangeText={setEditedBrand}
                  placeholder={t('scanScreen.enterBrand')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  autoFocus
                />
                <View style={styles.brandEditButtons}>
                  <TouchableOpacity
                    style={[styles.brandEditButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={() => {
                      setIsEditingBrand(false);
                      setEditedBrand('');
                    }}
                  >
                    <Text style={[styles.brandEditButtonText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.brandEditButton, { backgroundColor: colors.accent }]}
                    onPress={async () => {
                      const newBrand = editedBrand.trim();
                      if (product && newBrand) {
                        await updateProduct(product, { brand: newBrand }, recalls ?? []);
                      }
                      setIsEditingBrand(false);
                      setEditedBrand('');
                    }}
                  >
                    <Text style={[styles.brandEditButtonText, { color: colors.surface }]}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setEditedBrand(isKnownBrand(product.brand) ? product.brand : '');
                  setIsEditingBrand(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t('scan.brandLabel')} : ${product.brand}. ${t('common.edit')}`}
              >
                <Text style={[styles.brand, { color: colors.textPrimary }]}>{product.brand}  ✏️</Text>
                <Text style={[styles.editHint, { color: colors.accent }]}>{t('common.edit')}</Text>
              </TouchableOpacity>
            )}
            {product.productName ? (
              <Text style={[styles.productNameSub, { color: colors.textSecondary }]}>{product.productName}</Text>
            ) : null}
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('details.lotNumber')}</Text>
            <Text style={[styles.lot, { color: colors.accent }]}>{product.lotNumber}</Text>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>{t('details.recallStatusLabel')}</Text>
            <Text style={[styles.status, getStatusColor(product.recallStatus, colors)]}>
              {getStatusLabel(product.recallStatus, t)}
            </Text>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>{t('details.lastChecked')}</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>
              {product.lastCheckedAt
                ? new Date(product.lastCheckedAt).toLocaleString('fr-FR')
                : t('details.never')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.scanAnotherButton, { backgroundColor: colors.accent }]}
            onPress={() => router.replace('/(tabs)/scan' as any)}
          >
            <Text style={[styles.scanAnotherText, { color: colors.surface }]}>{t('details.actions.scanAnother')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.okButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={() => router.replace('/(tabs)/home' as any)}
          >
            <Text style={[styles.okText, { color: colors.textPrimary }]}>{t('details.actions.ok')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.danger }]}
            onPress={async () => {
              await removeProduct(product.id);
              router.back();
            }}
          >
            <Text style={[styles.deleteText, { color: colors.surface }]}>{t('details.actions.delete')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

function getStatusLabel(status: string, t: any): string {
  switch (status) {
    case 'recalled':
      return t('details.status.recalled');
    case 'safe':
      return t('details.status.safe');
    case 'warning':
      return t('details.status.warning');
    default:
      return t('details.status.unknown');
  }
}

function getStatusColor(status: string, colors: any) {
  switch (status) {
    case 'recalled':
      return { color: colors.danger };
    case 'safe':
      return { color: colors.success };
    case 'warning':
      return { color: colors.warning };
    default:
      return { color: colors.textSecondary };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  content: {
    padding: 24
  },
  section: {
    marginBottom: 24
  },
  card: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16
  },
  infoBox: {
    borderRadius: 20,
    padding: 18
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22
  },
  brand: {
    fontSize: 24,
    fontWeight: '800'
  },
  editHint: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2
  },
  productNameSub: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6
  },
  brandEditContainer: {
    gap: 10
  },
  brandInput: {
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2
  },
  brandEditButtons: {
    flexDirection: 'row',
    gap: 12
  },
  brandEditButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  brandEditButtonText: {
    fontSize: 15,
    fontWeight: '700'
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12
  },
  lot: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8
  },
  status: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8
  },
  value: {
    fontSize: 16,
    marginTop: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12
  },
  link: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600'
  },
  scanAnotherButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12
  },
  scanAnotherText: {
    fontSize: 16,
    fontWeight: '700'
  },
  okButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2
  },
  okText: {
    fontSize: 16,
    fontWeight: '700'
  },
  deleteButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center'
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '700'
  },
  missingText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16
  }
});
