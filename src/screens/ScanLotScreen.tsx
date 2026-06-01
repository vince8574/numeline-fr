import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Animated, StyleSheet, Vibration, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Scanner, type ScannerHandle } from '../components/Scanner';
import { performOcr, performOcrMultiFrame } from '../services/ocrService';
import { fetchRecallsByCountry } from '../services/apiService';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { GradientBackground } from '../components/GradientBackground';
import { ImmediateRecallAlert } from '../components/ImmediateRecallAlert';
import { PaywallModal } from '../components/PaywallModal';
import { saveLotPattern, validateLotAgainstBrandPatterns } from '../services/lotPatternService';
import { useSubscription } from '../hooks/useSubscription';
import { useVoiceGuide } from '../hooks/useVoiceGuide';
import { useVoiceCommands } from '../hooks/useVoiceCommands';

function detectLotLike(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').toUpperCase();
  // 1. "LOT" prefix followed by alphanumeric (highest confidence)
  if (/(?:^|[^A-Z])LOT[:\s\-.]*[A-Z0-9]{3,22}/.test(cleaned)) return true;
  // 2. Standalone "L" followed by digits at word boundary (e.g., "L12345", "L693A")
  if (/(?:^|[^A-Z])L\d{3,15}[A-Z0-9]{0,10}(?:[^A-Z0-9]|$)/.test(cleaned)) return true;
  // 3. Pure digit sequence 5-12 digits (excludes 13-14 digit EAN/GTIN barcodes)
  const digitTokens = cleaned.match(/(?:^|[^\d])(\d{5,12})(?:[^\d]|$)/g);
  if (digitTokens && digitTokens.length > 0) {
    return digitTokens.some((match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 5 && digits.length <= 12;
    });
  }
  return false;
}

function normalizeLotValue(lot: string) {
  return lot.replace(/\s+/g, '').replace(/[-_\.]/g, '').toUpperCase();
}

export function ScanLotScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { brand, productName, productImage } = useLocalSearchParams<{
    brand: string;
    productName?: string;
    productImage?: string;
  }>();
  const { addProduct, updateRecall } = useScannedProducts();
  const country = usePreferencesStore((state) => state.country);
  const { speak, stop: stopVoice, enabled: voiceEnabled } = useVoiceGuide();
  const reminderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);
  const lotInFrameAnnouncedRef = useRef(false);
  // Minuteur d'auto-capture de secours (étiquettes difficiles que l'auto-détection
  // par preview ne lit pas) — hands-free, important pour l'accessibilité.
  const autoCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lowLightActive, setLowLightActive] = useState(false);
  // Flash overlay animé déclenché juste avant l'auto-capture pour signaler
  // visuellement aux utilisateurs voyants qu'on est en train de prendre la photo.
  const flashAnim = useRef(new Animated.Value(0)).current;
  // Auto-allumage du flash torche au premier signal de basse lumière par session.
  // On respecte la préférence utilisateur : s'il a désactivé le flash après notre
  // auto-activation, on ne le réactive pas dans la même session.
  const autoFlashAppliedRef = useRef(false);
  const userOverrodeFlashRef = useRef(false);

  const [ocrText, setOcrText] = useState('');
  const [ocrSource, setOcrSource] = useState<string>('');
  const [lotNumber, setLotNumber] = useState('');
  const [lotCandidates, setLotCandidates] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfirmModalVisible, setConfirmModalVisible] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isEditingLot, setIsEditingLot] = useState(false);
  const [editedLot, setEditedLot] = useState('');
  const [isCheckingRecall, setIsCheckingRecall] = useState(false);
  const [hasRecall, setHasRecall] = useState<boolean | null>(null);
  const [matchedLot, setMatchedLot] = useState<string>('');
  const [matchedRecall, setMatchedRecall] = useState<any>(null);
  const [showRecallAlert, setShowRecallAlert] = useState(false);
  const [scannerResetToken, setScannerResetToken] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const { canScan, scansUsed, scanLimit, incrementScans } = useSubscription();

  const lotMutation = useMutation({
    mutationFn: async (lotPhoto: string | string[]) => {
      setErrorMessage('');
      speak(t('accessibility.voice.lotAnalyzing'), { priority: true });
      const { lot, result, candidates } = Array.isArray(lotPhoto)
        ? await performOcrMultiFrame(lotPhoto, brand)
        : await performOcr(lotPhoto, brand);
      setOcrText(result.text);
      setOcrSource(result.source || 'unknown');
      setLotNumber(lot);
      setLotCandidates(candidates || []);

      // Retour haptique à la détection d'un lot (double buzz, distinct du "tap"
      // de capture). On le déclenche ici car `lot` est la valeur fiable (le state
      // lotNumber n'est pas encore à jour dans onSuccess).
      if (lot) {
        Vibration.vibrate([0, 40, 60, 40]);
      }

      // Ne pas exiger qu'un lot soit détecté - on affiche tout le texte OCR
      // if (!lot) {
      //   throw new Error(t('scan.errors.lotExtractFailed'));
      // }

      // performOcrMultiFrame nettoie déjà ses frames en interne ; on ne supprime ici
      // que dans le cas single-frame.
      if (typeof lotPhoto === 'string') {
        try {
          await FileSystem.deleteAsync(lotPhoto, { idempotent: true });
        } catch (error) {
          console.warn('Failed to delete lot photo', error);
        }
      }

      // Vérifier les rappels EN ARRIÈRE-PLAN : on n'attend pas l'appel réseau pour
      // afficher le lot. Le résultat OCR s'affiche immédiatement (onSuccess), puis
      // l'alerte de rappel apparaît dès que la vérification répond.
      if (candidates && candidates.length > 0) {
        setIsCheckingRecall(true);
        setHasRecall(null);

        void (async () => {
          try {
            const { checkAllCandidates } = await import('../services/candidateMatcherService');
            const matchResult = await checkAllCandidates(candidates, brand, country);
            setHasRecall(matchResult.hasRecall);
            if (matchResult.matchedCandidate) {
              setMatchedLot(matchResult.matchedCandidate);
            }
            if (matchResult.hasRecall && matchResult.matchedRecall) {
              setMatchedRecall(matchResult.matchedRecall);
              setShowRecallAlert(true);
              speak(t('accessibility.voice.recallDetected'), { priority: true });
            } else {
              speak(t('accessibility.voice.productSafe'), { priority: true });
            }
          } catch (error) {
            console.error('Error checking recalls:', error);
          } finally {
            setIsCheckingRecall(false);
          }
        })();
      }

      return result.text; // Retourner le texte OCR complet (n'attend pas le rappel)
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || t('scan.errors.lotExtractFailed'));
      speak(t('accessibility.voice.scanError'), { priority: true });
    },
    onSuccess: () => {
      setConfirmModalVisible(true);
      if (lotNumber) {
        speak(t('accessibility.voice.lotDetected', { lot: lotNumber }));
      } else {
        speak(t('accessibility.voice.lotNotDetected'), { priority: true });
      }
    }
  });

  const resetFlow = useCallback(() => {
    setOcrText('');
    setOcrSource('');
    setLotNumber('');
    setLotCandidates([]);
    setErrorMessage('');
    setConfirmModalVisible(false);
    setIsEditingLot(false);
    setEditedLot('');
    setScannerResetToken((token) => token + 1);
    lotInFrameAnnouncedRef.current = false;
    autoFlashAppliedRef.current = false;
    userOverrodeFlashRef.current = false;
  }, []);

  const handleCapture = useCallback(
    async (uri: string | string[]) => {
      if (!brand) {
        setErrorMessage(t('scan.errors.brandFirst'));
        speak(t('accessibility.voice.captureBlocked'), { priority: true });
        const toDelete = Array.isArray(uri) ? uri : [uri];
        for (const u of toDelete) {
          try {
            await FileSystem.deleteAsync(u, { idempotent: true });
          } catch (error) {
            console.warn('Failed to delete unexpected capture', error);
          }
        }
        return;
      }

      if (reminderTimerRef.current) {
        clearInterval(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }

      lotMutation.mutate(uri);
    },
    [brand, lotMutation, t, speak]
  );

  const isProcessing = lotMutation.isPending || isFinalizing;
  // Miroir en ref pour lecture fraîche dans les minuteurs (closures).
  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  const handleConfirm = useCallback(async () => {
    if (!canScan) {
      setConfirmModalVisible(false);
      setShowPaywall(true);
      return;
    }

    const rawFinalLot = isEditingLot ? editedLot.trim().toUpperCase() : (lotNumber || '').trim();
    const normalizedOcrText = normalizeLotValue(ocrText || '');

    if (!brand) {
      setErrorMessage(t('scan.errors.brandFirst'));
      setConfirmModalVisible(false);
      return;
    }

    // Si pas de lot détecté et pas en mode édition, basculer en édition
    // pour que l'utilisateur saisisse le lot manuellement (au lieu de bailler silencieusement).
    if (!rawFinalLot && !isEditingLot) {
      setEditedLot('');
      setIsEditingLot(true);
      setErrorMessage(t('scan.errors.lotExtractFailed'));
      return;
    }

    const finalLot = rawFinalLot;
    const candidatesForMatch = [finalLot, ...lotCandidates]
      .filter(Boolean)
      .map((candidate) => normalizeLotValue(candidate));

    if (!finalLot) {
      // L'utilisateur est en mode édition mais n'a rien saisi
      setErrorMessage(t('scan.errors.lotExtractFailed'));
      return;
    }

    setIsFinalizing(true);

    try {
      // 1) Sauvegarde immédiate dans l'historique — tolérant aux erreurs réseau qui suivent
      const product = await addProduct({
        brand,
        lotNumber: finalLot,
        ...(productName && { productName }),
        ...(productImage && { productImage })
      });

      incrementScans();

      // 2) Enrichissement non-bloquant : pattern validation
      try {
        const validation = await validateLotAgainstBrandPatterns(brand, finalLot);
        if (!validation.isValid) {
          console.log(`[ScanLotScreen] New lot pattern detected for ${brand}: ${finalLot}`);
          await saveLotPattern(brand, finalLot);
        }
      } catch (patternError) {
        console.warn('[ScanLotScreen] Pattern validation failed (non-blocking):', patternError);
      }

      // 3) Enrichissement non-bloquant : matching rappels
      try {
        const recallList = await fetchRecallsByCountry(country);
        const matchingRecalls = recallList.filter((recall) => {
          const brandMatch = recall.brand ? recall.brand.toLowerCase() === brand.toLowerCase() : true;
          if (!recall.lotNumbers || recall.lotNumbers.length === 0) {
            return brandMatch;
          }

          const lotMatch = recall.lotNumbers.some((lot) => {
            const normalizedRecallLot = normalizeLotValue(lot);
            if (!normalizedRecallLot) {
              return false;
            }

            const candidateHit = candidatesForMatch.some(
              (candidate) =>
                candidate.includes(normalizedRecallLot) || normalizedRecallLot.includes(candidate)
            );
            const inFullText = normalizedOcrText.includes(normalizedRecallLot);

            return candidateHit || inFullText;
          });

          return brandMatch && lotMatch;
        });

        await updateRecall(product, matchingRecalls);
      } catch (recallError) {
        console.warn('[ScanLotScreen] Recall matching failed (non-blocking):', recallError);
      }

      resetFlow();
      router.replace({ pathname: '/details/[id]', params: { id: product.id } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('scan.errors.scanFailed'));
    } finally {
      setConfirmModalVisible(false);
      setIsFinalizing(false);
      setIsEditingLot(false);
      setEditedLot('');
    }
  }, [
    addProduct,
    brand,
    canScan,
    country,
    incrementScans,
    lotNumber,
    isEditingLot,
    editedLot,
    ocrText,
    lotCandidates,
    resetFlow,
    router,
    t,
    updateRecall
  ]);

  const handleRestart = useCallback(() => {
    setLotNumber('');
    setOcrText('');
    setOcrSource('');
    setLotCandidates([]);
    setErrorMessage('');
    setConfirmModalVisible(false);
    setIsEditingLot(false);
    setEditedLot('');
    setScannerResetToken((token) => token + 1);
    lotInFrameAnnouncedRef.current = false;
  }, []);

  const handleEditLot = useCallback(() => {
    // Pré-remplir uniquement avec le numéro de lot détecté (jamais le texte OCR brut)
    const initial = (lotNumber || '').replace(/\s+/g, '').slice(0, 22);
    setEditedLot(initial);
    setIsEditingLot(true);
  }, [lotNumber]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingLot(false);
    setEditedLot('');
  }, []);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const triggerCaptureFeedback = useCallback(() => {
    // Vibration courte (20 ms) — équivalent d'un "tap" sur Android, et fonctionne
    // côté iOS aussi sans dépendance supplémentaire.
    Vibration.vibrate(20);
    // Flash blanc qui apparaît puis disparaît (~280 ms total).
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.45, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start();
  }, [flashAnim]);

  const handlePreviewOcrText = useCallback(
    (text: string) => {
      if (lotInFrameAnnouncedRef.current || isProcessing) return;
      if (!detectLotLike(text)) return;
      lotInFrameAnnouncedRef.current = true;
      // Auto-capture pour tout le monde : sur tablette le bouton photo est
      // difficile d'accès. Les utilisateurs malvoyants reçoivent en plus une
      // annonce et un délai plus long pour la laisser passer ; les voyants
      // ont une capture quasi-instantanée + retour haptique + flash visuel.
      if (voiceEnabled) {
        speak(t('accessibility.voice.lotInFrame'), { priority: true });
      }
      const delayMs = voiceEnabled ? 1200 : 400;
      setTimeout(() => {
        if (!isProcessing) {
          triggerCaptureFeedback();
          scannerRef.current?.triggerCapture();
        }
      }, delayMs);
    },
    [isProcessing, speak, t, voiceEnabled, triggerCaptureFeedback]
  );

  const handleLowLight = useCallback(
    (isLow: boolean) => {
      setLowLightActive(isLow);
      if (isLow) {
        speak(t('accessibility.voice.lowLight'), { priority: true, dedupeMs: 12000 });
        // Auto-allumage du flash uniquement la première fois et seulement si
        // l'utilisateur ne l'a pas explicitement éteint depuis.
        if (
          !autoFlashAppliedRef.current &&
          !userOverrodeFlashRef.current &&
          !(scannerRef.current?.isFlashOn() ?? false)
        ) {
          scannerRef.current?.setFlash(true);
          autoFlashAppliedRef.current = true;
          speak(t('accessibility.voice.flashOn'), { priority: true });
        }
      }
    },
    [speak, t]
  );

  const handleCoachingHint = useCallback(
    (hint: 'blur' | 'tooFar' | 'tooClose') => {
      if (isProcessing || !voiceEnabled) return;
      const key = `accessibility.voice.${hint}`;
      speak(t(key), { priority: true, dedupeMs: 8000 });
    },
    [isProcessing, voiceEnabled, speak, t]
  );

  const handleVoiceCommand = useCallback(
    (command: 'photo' | 'flash_on' | 'flash_off') => {
      if (command === 'photo') {
        if (isProcessing) return;
        speak(t('accessibility.voice.photoCommand'), { priority: true });
        scannerRef.current?.triggerCapture();
        return;
      }
      if (command === 'flash_on') {
        scannerRef.current?.setFlash(true);
        userOverrodeFlashRef.current = false;
        speak(t('accessibility.voice.flashOn'), { priority: true });
        return;
      }
      if (command === 'flash_off') {
        scannerRef.current?.setFlash(false);
        userOverrodeFlashRef.current = true;
        speak(t('accessibility.voice.flashOff'), { priority: true });
      }
    },
    [isProcessing, speak, t]
  );

  useVoiceCommands(voiceEnabled && !isProcessing, {
    onCommand: handleVoiceCommand
  });

  useFocusEffect(
    useCallback(() => {
      setScannerResetToken((token) => token + 1);

      if (voiceEnabled) {
        speak(t('accessibility.voice.scanLotReady'), { priority: true });
        reminderTimerRef.current = setInterval(() => {
          speak(t('accessibility.voice.scanLotTip'));
        }, 18000);
      }

      return () => {
        if (reminderTimerRef.current) {
          clearInterval(reminderTimerRef.current);
          reminderTimerRef.current = null;
        }
        stopVoice();
      };
    }, [voiceEnabled, speak, stopVoice, t])
  );

  // Auto-capture de secours : si l'auto-détection par preview n'a rien donné au
  // bout de ~7 s (étiquette à faible contraste / impression point-matrice), on
  // force une capture pleine résolution qui déclenche l'OCR complet (ML Kit +
  // fallback Vision/Claude). Mains libres → indispensable pour l'accessibilité.
  // Redémarré à chaque (ré)init du scanner (focus, "Recommencer", etc.).
  useEffect(() => {
    if (autoCaptureTimerRef.current) clearTimeout(autoCaptureTimerRef.current);
    autoCaptureTimerRef.current = setTimeout(() => {
      if (!lotInFrameAnnouncedRef.current && !isProcessingRef.current) {
        lotInFrameAnnouncedRef.current = true;
        triggerCaptureFeedback();
        scannerRef.current?.triggerCapture();
      }
    }, 3000);
    return () => {
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [scannerResetToken, triggerCaptureFeedback]);

  return (
    <GradientBackground>
      <Scanner
        ref={scannerRef}
        key={`lot-scanner-${scannerResetToken}`}
        onCapture={handleCapture}
        enableBarcodeScanning={false}
        isProcessing={isProcessing}
        mode="band"
        resetToken={scannerResetToken}
        flashPosition="top-right"
        aiMessage={!lotNumber ? t('scan.aiPrecision') : undefined}
        onBack={handleGoBack}
        onRestart={handleRestart}
        previewOcrEnabled
        onPreviewOcrText={handlePreviewOcrText}
        lowLightDetectionEnabled
        onLowLight={handleLowLight}
        onCoachingHint={handleCoachingHint}
        multiFrameCount={2}
        multiFrameDelayMs={200}
        hideCaptureButton
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.captureFlashOverlay, { opacity: flashAnim }]}
      />

      <ScrollView style={styles.feedback} contentContainerStyle={styles.feedbackContent}>
        {lowLightActive && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              const next = !(scannerRef.current?.isFlashOn() ?? false);
              scannerRef.current?.setFlash(next);
              userOverrodeFlashRef.current = !next;
              speak(t(next ? 'accessibility.voice.flashOn' : 'accessibility.voice.flashOff'), { priority: true });
            }}
            style={[styles.lowLightBanner, { backgroundColor: colors.warning, borderColor: colors.warning }]}
          >
            <Ionicons name="bulb-outline" size={22} color="#000" />
            <Text style={styles.lowLightBannerText}>{t('scan.lowLightHint')}</Text>
          </TouchableOpacity>
        )}
        <View
          style={[
            styles.instructions,
            {
              backgroundColor: 'rgba(255,200,87,0.18)',
              borderColor: colors.warning,
              shadowColor: colors.warning
            }
          ]}
        >
          <Text
            style={[
              styles.stepLabel,
              { color: colors.warning }
            ]}
          >
            {t('scan.lotStep')}
          </Text>
          <Text
            style={[
              styles.instructionText,
              { color: colors.textPrimary }
            ]}
          >
            {isProcessing ? t('scan.lotAnalyzing') : t('scan.lotInstruction')}
          </Text>
        </View>

        {(productImage || productName) && (
          <View style={[styles.productInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {productImage ? (
              <Image
                source={{ uri: productImage }}
                style={styles.productImageSmall}
                resizeMode="contain"
              />
            ) : null}
            {productName ? (
              <Text style={[styles.productNameSmall, { color: colors.textPrimary }]}>
                {productName}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: brand ? colors.surface : colors.surfaceAlt,
                borderColor: brand ? colors.accent : colors.surfaceAlt
              }
            ]}
          >
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{t('scan.brandLabel')}</Text>
            <Text style={[styles.statusValue, { color: brand ? colors.success : colors.textSecondary }]}>
              {brand || t('scan.waiting')}
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: lotNumber ? colors.surface : colors.surfaceAlt,
                borderColor: lotNumber ? colors.accent : colors.surfaceAlt
              }
            ]}
          >
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{t('scan.lotLabel')}</Text>
            <Text style={[styles.statusValue, { color: colors.textPrimary }]}>
              {lotNumber || (lotMutation.isPending ? t('scan.analyzing') : t('scan.waiting'))}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('scan.detectedLot')}</Text>
        <Text style={[styles.lotText, { color: colors.accent }]}>{lotNumber || '--'}</Text>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        ) : null}

        <View style={[styles.appDisclaimerBox, { backgroundColor: colors.surfaceAlt, borderColor: 'rgba(255,255,255,0.06)' }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.appDisclaimerText, { color: colors.textPrimary }]}>
            {t('common.appDisclaimer')}
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={isConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <ScrollView
          contentContainerStyle={styles.modalOverlay}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('scan.confirmLotTitle')}
            </Text>

            {isEditingLot ? (
              <>
                <Text style={[styles.modalMessage, { color: colors.textSecondary, marginTop: 12 }]}>
                  Ou modifier manuellement :
                </Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.accent }]}
                  value={editedLot}
                  onChangeText={(value) => setEditedLot(value.replace(/\s+/g, '').slice(0, 22))}
                  placeholder="Entrez le numéro de lot"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  maxLength={22}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                    onPress={handleCancelEdit}
                    disabled={isFinalizing}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                      Annuler
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.accent }]}
                    onPress={handleConfirm}
                    disabled={isFinalizing}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.surface }]}>
                      {t('scan.validate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                  {lotNumber ? t('scan.detectedLot') : t('scan.errors.lotExtractFailed')}
                </Text>
                <View style={[styles.ocrTextContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.ocrText, { color: colors.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: 1, textAlign: 'center' }]}>
                    {lotNumber || '--'}
                  </Text>
                </View>

                {ocrSource && (
                  <View
                    style={[
                      styles.ocrSourceContainer,
                      {
                        backgroundColor:
                          ocrSource === 'claude-fallback'
                            ? '#f3e5f5'
                            : ocrSource === 'vision-fallback'
                              ? '#e8f5e9'
                              : '#e3f2fd'
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.ocrSourceText,
                        {
                          color:
                            ocrSource === 'claude-fallback'
                              ? '#6a1b9a'
                              : ocrSource === 'vision-fallback'
                                ? '#2e7d32'
                                : '#1565c0'
                        }
                      ]}
                    >
                      {ocrSource === 'claude-fallback'
                        ? '🧠 Claude Sonnet IA'
                        : ocrSource === 'vision-fallback'
                          ? '🤖 Google Vision API'
                          : ocrSource === 'mlkit'
                            ? '📱 ML Kit'
                            : `📋 ${ocrSource}`}
                    </Text>
                  </View>
                )}

                {isCheckingRecall && (
                  <View style={styles.checkingContainer}>
                    <Text style={[styles.checkingText, { color: colors.textSecondary }]}>
                      🔍 Vérification des rappels en cours...
                    </Text>
                  </View>
                )}

                {!isCheckingRecall && hasRecall !== null && (
                  <View style={[
                    styles.recallStatusContainer,
                    {
                      backgroundColor: hasRecall ? '#fee' : '#efe',
                      borderColor: hasRecall ? '#f44' : '#4a4'
                    }
                  ]}>
                    <Text style={[styles.recallStatusText, { color: hasRecall ? '#f44' : '#4a4' }]}>
                      {hasRecall
                        ? `⚠️ RAPPEL DÉTECTÉ ${matchedLot ? `(${matchedLot})` : ''}`
                        : '✅ PRODUIT SAFE - Aucun rappel'}
                    </Text>
                  </View>
                )}


                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}
                  onPress={handleEditLot}
                >
                  <Ionicons name="create-outline" size={18} color={colors.accent} />
                  <Text style={[styles.editButtonText, { color: colors.accent }]}>
                    {t('common.edit')}
                  </Text>
                </TouchableOpacity>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                    onPress={handleRestart}
                    disabled={isFinalizing}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                      {t('scan.restart')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.accent }]}
                    onPress={handleConfirm}
                    disabled={isFinalizing}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.surface }]}>
                      {t('scan.validate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <ImmediateRecallAlert
        visible={showRecallAlert}
        recall={matchedRecall}
        matchedLot={matchedLot}
        onClose={() => setShowRecallAlert(false)}
      />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        scansUsed={scansUsed}
        scanLimit={scanLimit}
      />
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22
  },
  lotText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1
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
  backButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  modalOverlay: {
    flexGrow: 1,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    marginVertical: 8
  },
  candidatesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12
  },
  candidateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 4
  },
  candidateText: {
    fontSize: 14,
    fontWeight: '600'
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
  ocrTextContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    maxHeight: 120
  },
  ocrText: {
    fontSize: 14,
    lineHeight: 20
  },
  ocrSourceContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 8
  },
  ocrSourceText: {
    fontSize: 12,
    fontWeight: '600'
  },
  checkingContainer: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  checkingText: {
    fontSize: 14,
    fontStyle: 'italic'
  },
  recallStatusContainer: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    alignItems: 'center'
  },
  recallStatusText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  },
  productInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginVertical: 8
  },
  productImageSmall: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5'
  },
  productNameSmall: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18
  },
  appDisclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1
  },
  appDisclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1
  },
  lowLightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  lowLightBannerText: {
    flex: 1,
    color: '#000',
    fontSize: 14,
    fontWeight: '700'
  },
  captureFlashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF'
  }
});
