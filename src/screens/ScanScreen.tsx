import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Scanner } from '../components/Scanner';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { GradientBackground } from '../components/GradientBackground';
import { getProductByBarcode } from '../services/openFoodFactsService';
import { useFocusEffect } from '@react-navigation/native';

export function ScanScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [brandText, setBrandText] = useState('');
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfirmModalVisible, setConfirmModalVisible] = useState(false);
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [editedBrand, setEditedBrand] = useState('');
  const [scannerResetToken, setScannerResetToken] = useState(0);

  const resetFlow = useCallback(() => {
    setBrandText('');
    setProductName('');
    setProductImage('');
    setErrorMessage('');
    setConfirmModalVisible(false);
    setIsEditingBrand(false);
    setEditedBrand('');
    setScannerResetToken((t) => t + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Remonter la camÇ¸ra quand on revient sur l'Ç¸cran
      setScannerResetToken((t) => t + 1);
      return () => {};
    }, [])
  );

  const handleConfirm = useCallback(() => {
    const finalBrand = isEditingBrand ? editedBrand.trim() : brandText;

    if (!finalBrand) {
      setErrorMessage(t('scan.errors.brandFirst'));
      setConfirmModalVisible(false);
      return;
    }

    // Rediriger vers l'écran de scan du lot avec la marque et les infos produit
    setConfirmModalVisible(false);
    const params = new URLSearchParams({
      brand: finalBrand,
      ...(productName && { productName }),
      ...(productImage && { productImage })
    });
    router.push(`/scan-lot?${params.toString()}` as any);
  }, [brandText, isEditingBrand, editedBrand, productName, productImage, router, t]);

  const handleRestart = useCallback(() => {
    resetFlow();
  }, [resetFlow]);

  const handleEditBrand = useCallback(() => {
    setEditedBrand(brandText);
    setIsEditingBrand(true);
  }, [brandText]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingBrand(false);
    setEditedBrand('');
  }, []);

  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    if (brandText) {
      return;
    }

    console.log('[ScanScreen] Barcode scanned:', barcode);
    setErrorMessage('');

    try {
      const productInfo = await getProductByBarcode(barcode);

      if (productInfo) {
        console.log('[ScanScreen] Product found:', productInfo);
        setBrandText(productInfo.brand);
        setProductName(productInfo.productName);
        setProductImage(productInfo.imageUrl || '');
        setConfirmModalVisible(true);
      } else {
        setErrorMessage(t('scan.errors.barcodeNotFound'));
      }
    } catch (error) {
      console.error('[ScanScreen] Barcode scan error:', error);
      setErrorMessage(t('scan.errors.barcodeScanFailed'));
    }
  }, [brandText, t]);

  const handleCapture = useCallback(async (uri: string) => {
    // Pas de capture de photo pour l'écran de scan de code-barres
    console.log('[ScanScreen] Photo capture not needed for barcode screen');
  }, []);

  return (
    <GradientBackground>
      <Scanner
        onCapture={handleCapture}
        onBarcodeScanned={handleBarcodeScanned}
        enableBarcodeScanning={true}
        isProcessing={false}
        mode="barcode"
        resetToken={scannerResetToken}
      />

      <ScrollView style={styles.feedback} contentContainerStyle={styles.feedbackContent}>
        <View
          style={[
            styles.instructions,
            {
              backgroundColor: colors.accentSoft,
              borderColor: colors.accent,
              shadowColor: colors.accent
            }
          ]}
        >
          <Text
            style={[
              styles.stepLabel,
              { color: colors.accent }
            ]}
          >
            {t('scan.brandStep')}
          </Text>
          <Text
            style={[
              styles.instructionText,
              styles.instructionHighlight,
              { color: colors.textPrimary }
            ]}
          >
            {t('scan.barcodeInstruction')}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: brandText ? colors.surface : colors.surfaceAlt,
                borderColor: brandText ? colors.accent : colors.surfaceAlt
              }
            ]}
          >
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{t('scan.brandLabel')}</Text>
            <Text style={[styles.statusValue, { color: brandText ? colors.success : colors.textSecondary }]}>
              {brandText || t('scan.waiting')}
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: colors.surface }]}
          onPress={resetFlow}
        >
          <Text style={[styles.resetText, { color: colors.textPrimary }]}>{t('scan.restart')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.manualButton, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/manual-entry')}
        >
          <Text style={[styles.manualButtonText, { color: colors.textPrimary }]}>{t('scan.manualEntry')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('scan.confirmBrandTitle')}
            </Text>

            {isEditingBrand ? (
              <>
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                  Modifier la marque détectée :
                </Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.accent }]}
                  value={editedBrand}
                  onChangeText={setEditedBrand}
                  placeholder="Entrez la marque"
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                    onPress={handleCancelEdit}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                      Annuler
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.accent }]}
                    onPress={handleConfirm}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.surface }]}>
                      {t('scan.validate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {productImage ? (
                  <Image
                    source={{ uri: productImage }}
                    style={styles.productImage}
                    resizeMode="contain"
                  />
                ) : null}

                {productName ? (
                  <Text style={[styles.productName, { color: colors.textPrimary }]}>
                    {productName}
                  </Text>
                ) : null}

                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                  {t('scan.confirmBrandMessage', { brand: brandText || t('common.unknown') })}
                </Text>

                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}
                  onPress={handleEditBrand}
                >
                  <Text style={[styles.editButtonText, { color: colors.accent }]}>
                    ✏️ Modifier
                  </Text>
                </TouchableOpacity>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                    onPress={handleRestart}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                      {t('scan.restart')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.accent }]}
                    onPress={handleConfirm}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.surface }]}>
                      {t('scan.validate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  feedback: {
    maxHeight: 380,
    paddingHorizontal: 24
  },
  feedbackContent: {
    paddingVertical: 16,
    gap: 16
  },
  instructions: {
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600'
  },
  instructionHighlight: {
    fontWeight: '900'
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12
  },
  statusPill: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  statusValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700'
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center'
  },
  resetText: {
    fontSize: 16,
    fontWeight: '700'
  },
  manualButton: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center'
  },
  manualButtonText: {
    fontSize: 15,
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 28,
    gap: 20
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center'
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  editInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 8
  },
  editButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    marginVertical: 8
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  productImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f5f5f5'
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8
  }
});
