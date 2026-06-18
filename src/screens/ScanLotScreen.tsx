import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Image, Alert, Animated, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Scanner, type ScannerHandle } from '../components/Scanner';
import { performOcr, performOcrMultiFrame, bestDisplayLot, isReliableLot, type OcrStage } from '../services/ocrService';
import { fetchRecallsByCountry } from '../services/apiService';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { GradientBackground } from '../components/GradientBackground';
import { ResultBottomNav } from '../components/ResultBottomNav';
import { ImmediateRecallAlert } from '../components/ImmediateRecallAlert';
import { Ionicons } from '@expo/vector-icons';
import { saveLotPattern, validateLotAgainstBrandPatterns } from '../services/lotPatternService';
import { useSubscription } from '../hooks/useSubscription';
import { PaywallModal } from '../components/PaywallModal';
import * as Notifications from 'expo-notifications';
import { useVoiceGuide } from '../hooks/useVoiceGuide';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { useKeepAwake } from 'expo-keep-awake';

// En mode malvoyant on laisse beaucoup plus de temps avant la capture auto :
// l'utilisateur a besoin de stabiliser le téléphone face à l'étiquette.
const AUTO_CAPTURE_DELAY_VOICE_MS = 3000;
const AUTO_CAPTURE_DELAY_SIGHTED_MS = 400;

// Accessibility-mode constants for blind lot scanning.
const MAX_ACCESSIBILITY_RETRIES = 10;
// Cap paid OCR (Vision/Claude) calls across a continuous blind-scan session.
const MAX_PAID_OCR_PER_SESSION = 6;
const COACHING_SUPPRESS_MS = 7000;
const LOT_COACH_ROTATION = {
  1: ['lotCoach1a', 'lotCoach1b', 'lotCoach1c'], // retries 1-3: keep moving
  2: ['lotCoach2a', 'lotCoach2b', 'lotCoach2c'], // retries 4-6: where to look
  3: ['lotCoach3a', 'lotCoach3b', 'lotCoach3c'], // retries 7-9: insist + hold steady
} as const;
function pickLotCoachKey(retry: number): string {
  if (retry >= MAX_ACCESSIBILITY_RETRIES) return 'accessibility.voice.lotGiveUpSoon';
  const phase = retry <= 3 ? 1 : retry <= 6 ? 2 : 3;
  const variant = (retry - 1) % 3;
  return `accessibility.voice.${LOT_COACH_ROTATION[phase][variant]}`;
}

// Presence detection: reuses isReliableLot so the preview only triggers a capture
// on a real lot-shaped token (not a date / unit / price / word).
function detectLotLike(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').toUpperCase();
  if (/(?:^|[^A-Z])LOT[:\s\-.]*[A-Z0-9]{3,22}/.test(cleaned)) return true;
  if (/(?:^|[^A-Z])L\d{3,15}[A-Z0-9]{0,10}(?:[^A-Z0-9]|$)/.test(cleaned)) return true;
  const tokens = cleaned.match(/[A-Z0-9\/]{4,24}/g) || [];
  return tokens.some((tok) => isReliableLot(tok));
}

function normalizeLotValue(lot: string) {
  // Also strip "/" for recall COMPARISON (4100/01473 -> 410001473). Display keeps it.
  return lot.replace(/\s+/g, '').replace(/[-_.\/]/g, '').toUpperCase();
}

export function ScanLotScreen() {
  // Prevent the screen from sleeping during lot detection (can be long in
  // accessibility mode: continuous scan until consensus).
  useKeepAwake();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { brand, productName, productImage } = useLocalSearchParams<{
    brand: string;
    productName?: string;
    productImage?: string;
  }>();
  const { addProduct, updateRecall, updateProduct } = useScannedProducts();
  const country = usePreferencesStore((state) => state.country);
  const accessibilityMode = usePreferencesStore((state) => state.accessibilityMode);
  const { canScan, scansUsed, scanLimit, incrementScans } = useSubscription();
  const { speak } = useVoiceGuide();

  const scannerRef = useRef<ScannerHandle | null>(null);
  const lotInFrameAnnouncedRef = useRef(false);
  const autoFlashAppliedRef = useRef(false);
  const userOverrodeFlashRef = useRef(false);
  const autoCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const isProcessingRef = useRef(false);
  // Vrai tant que l'écran de lot est au premier plan. Sert de garde-fou contre
  // toute (re)capture automatique après qu'on a quitté la page (pas de boucle).
  const isScreenFocusedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  // Accessibility blind-mode: retry loop + anti-truncation consensus.
  const lastLotRef = useRef('');
  const accessibilityRetryRef = useRef(0);
  const lastCoachingAtRef = useRef(0);
  const paidOcrCountRef = useRef(0);
  const lotSeenCountRef = useRef<Map<string, { count: number; display: string }>>(new Map());
  const lastIntraAgreementRef = useRef(0);

  const [ocrText, setOcrText] = useState('');
  const [ocrSource, setOcrSource] = useState<string>('');
  const [ocrStage, setOcrStage] = useState<OcrStage | null>(null);
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
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const [scannerResetToken, setScannerResetToken] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  // Modèle freemium FR : quota géré par useSubscription (5 scans gratuits
  // one-shot suivis côté serveur, puis abonnement). Quota épuisé → paywall.
  const ensureScanQuota = useCallback(async (): Promise<boolean> => {
    if (canScan) return true;
    setShowPaywall(true);
    return false;
  }, [canScan]);

  const lotMutation = useMutation({
    mutationFn: async (lotPhoto: string | string[]) => {
      setErrorMessage('');
      setOcrStage('mlkit');
      if (accessibilityMode) {
        // Non-priority + dedupe: fires on every capture, must not cut the guidance.
        speak(t('accessibility.voice.lotAnalyzing'), { dedupeMs: 9000 });
      }
      // Cap paid OCR (Vision/Claude) per scan session in accessibility continuous mode.
      const allowPaidFallback = paidOcrCountRef.current < MAX_PAID_OCR_PER_SESSION;
      const { lot, result, candidates, intraFrameAgreement } = Array.isArray(lotPhoto)
        ? await performOcrMultiFrame(lotPhoto, brand, setOcrStage, { allowPaidFallback })
        : await performOcr(lotPhoto, brand, setOcrStage, { allowPaidFallback });
      if (allowPaidFallback && (result.source === 'vision-fallback' || result.source === 'claude-fallback')) {
        paidOcrCountRef.current += 1;
      }
      // Toujours afficher UN SEUL numéro de lot : le lot extrait, sinon le
      // meilleur candidat plausible. On n'affiche jamais une liste de tokens
      // séparés par des '/' (ce que renvoyait l'ancien repli sur les candidats).
      // lot extrait, sinon LE MEILLEUR candidat (le plus long/lot-like), pas le
      // premier — pour afficher "249334315" et non un fragment "2493".
      const displayLot = lot || bestDisplayLot(candidates || []);
      // Vibration de confirmation dès qu'un numéro de lot est détecté.
      if (displayLot) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setOcrText(result.text);
      setOcrSource(result.source || 'unknown');
      setLotNumber(displayLot);
      setLotCandidates(candidates || []);

      // Anti-truncation consensus (accessibility only): record this read's vote,
      // then decide if the lot is ACCEPTED = reliable AND stable (>=2 agreeing reads
      // or >=2 frames agree). A truncated fragment varies on rotation → never stable.
      lastLotRef.current = displayLot;
      lastIntraAgreementRef.current = intraFrameAgreement ?? 0;
      if (displayLot && isReliableLot(displayLot)) {
        const voteKey = normalizeLotValue(displayLot);
        const prev = lotSeenCountRef.current.get(voteKey);
        lotSeenCountRef.current.set(voteKey, { count: (prev?.count ?? 0) + 1, display: displayLot });
      }
      const seenCount = displayLot
        ? (lotSeenCountRef.current.get(normalizeLotValue(displayLot))?.count ?? 0)
        : 0;
      const agreement = Math.max(seenCount, intraFrameAgreement ?? 0);
      // Mode malvoyant = MÊME logique que le mode normal : on confirme dès la
      // PREMIÈRE lecture fiable (plus d'exigence de consensus 2 lectures, qui ne
      // convergeait jamais sur les codes lus différemment à chaque capture → le
      // lot n'était jamais détecté). On garde juste isReliableLot pour ne pas
      // annoncer une date/un parasite. La voix lit le lot + le statut de rappel.
      const accepted = accessibilityMode
        ? !!displayLot && isReliableLot(displayLot)
        : !!displayLot;

      // Ne pas exiger qu'un lot soit dÃ©tectÃ© - on affiche tout le texte OCR
      // if (!lot) {
      //   throw new Error(t('scan.errors.lotExtractFailed'));
      // }

      // performOcrMultiFrame nettoie ses frames en interne ; ici on ne supprime
      // que la frame unique (cas performOcr).
      if (typeof lotPhoto === 'string') {
        try {
          await FileSystem.deleteAsync(lotPhoto, { idempotent: true });
        } catch (error) {
          console.warn('Failed to delete lot photo', error);
        }
      }

      // Annonce du lot UNIQUEMENT s'il est confirmé (fiable + stable). Sinon, le
      // onSuccess s'occupe du guidage rotatif / de l'abandon (pas d'annonce prématurée).
      if (accessibilityMode && accepted) {
        speak(t('accessibility.voice.lotDetected', { lot: displayLot }));
      }

      // Vérifier les rappels en arrière-plan — seulement sur une lecture confirmée
      // (en mode malvoyant) ou toujours en mode voyant. Évite d'annoncer un statut
      // de rappel sur un lot encore incertain (tronqué).
      if ((!accessibilityMode || accepted) && displayLot) {
        setIsCheckingRecall(true);
        setHasRecall(null);

        const { checkAllCandidates } = await import('../services/candidateMatcherService');

        try {
          // Match recalls against ONLY the confirmed lot — never the noisy
          // candidate list (partial/misread tokens, dates) that caused false alerts.
          const matchResult = await checkAllCandidates([displayLot], brand, country);
          setHasRecall(matchResult.hasRecall);
          setVerifiedAt(Date.now());
          if (matchResult.matchedCandidate) {
            setMatchedLot(matchResult.matchedCandidate);
          }
          if (matchResult.hasRecall && matchResult.matchedRecall) {
            setMatchedRecall(matchResult.matchedRecall);
            // Afficher immÃ©diatement l'alerte de rappel
            setShowRecallAlert(true);
          }
          if (accessibilityMode) {
            // Non-prioritaire : s'enchaîne après "analyse"/"lot détecté" au lieu
            // de les couper (sinon la voix paraît tronquée pendant le scan).
            speak(
              matchResult.hasRecall
                ? t('accessibility.voice.recallDetected')
                : t('accessibility.voice.productSafe')
            );
          }
        } catch (error) {
          console.error('Error checking recalls:', error);
        } finally {
          setIsCheckingRecall(false);
        }
      }

      return result.text; // Retourner le texte OCR complet
    },
    onError: (error: Error) => {
      setOcrStage(null);
      setErrorMessage(error.message || t('scan.errors.lotExtractFailed'));
      if (accessibilityMode) {
        speak(t('accessibility.voice.scanError'), { priority: true });
      }
    },
    onSuccess: () => {
      setOcrStage(null);
      const lot = lastLotRef.current;
      const key = lot ? normalizeLotValue(lot) : '';
      const seen = key ? (lotSeenCountRef.current.get(key)?.count ?? 0) : 0;
      const intra = lastIntraAgreementRef.current;
      const agreement = Math.max(seen, intra);
      const hadReliableRead = !!lot && isReliableLot(lot);
      // Voir mutationFn : on confirme dès la 1re lecture fiable (parité avec le
      // mode normal). Le retry ci-dessous ne sert plus qu'au cas SANS lecture
      // fiable (OCR n'a rien sorti d'exploitable).
      const detected = accessibilityMode
        ? hadReliableRead
        : !!lot;

      // Accessibility: not yet confirmed → keep scanning with rotating guidance.
      if (accessibilityMode && !detected && accessibilityRetryRef.current < MAX_ACCESSIBILITY_RETRIES) {
        accessibilityRetryRef.current += 1;
        const retry = accessibilityRetryRef.current;
        const sinceHint = Date.now() - lastCoachingAtRef.current;
        if (retry >= MAX_ACCESSIBILITY_RETRIES) {
          speak(t('accessibility.voice.lotGiveUpSoon'), { priority: true });
        } else if (sinceHint > COACHING_SUPPRESS_MS) {
          lastCoachingAtRef.current = Date.now();
          if (hadReliableRead && agreement === 1) {
            // Reliable code read ONCE but not stable → likely truncated. Actionable cue.
            speak(t('accessibility.voice.lotPartialSeen'), { priority: false, dedupeMs: 7000 });
          } else {
            speak(t(pickLotCoachKey(retry)), { priority: false, dedupeMs: 7000 });
          }
        }
        // Re-arm WITHOUT opening modal. Do NOT clear lotSeenCountRef (consensus accumulates).
        setOcrText('');
        setLotNumber('');
        lastLotRef.current = '';
        setLotCandidates([]);
        setConfirmModalVisible(false);
        lotInFrameAnnouncedRef.current = false;
        setScannerResetToken((tok) => tok + 1);
        return;
      }

      // Give-up without consensus → show best (most-seen) reliable guess, not empty.
      if (accessibilityMode && !detected && lotSeenCountRef.current.size > 0) {
        let best = { count: 0, display: '' };
        for (const v of lotSeenCountRef.current.values()) if (v.count > best.count) best = v;
        if (best.display) { setLotNumber(best.display); lastLotRef.current = best.display; }
      }

      accessibilityRetryRef.current = 0;
      setConfirmModalVisible(true);
      // lotDetected was already announced in mutationFn when accepted; here only
      // the give-up "not detected" needs announcing.
      if (accessibilityMode && !detected) {
        speak(t('accessibility.voice.lotNotDetected'), { priority: true });
      }
    }
  });

  const resetFlow = useCallback(() => {
    setOcrText('');
    setOcrSource('');
    setOcrStage(null);
    setLotNumber('');
    setLotCandidates([]);
    setErrorMessage('');
    setConfirmModalVisible(false);
    setIsEditingLot(false);
    setEditedLot('');
    setVerifiedAt(null);
    setScannerResetToken((token) => token + 1);
    lotInFrameAnnouncedRef.current = false;
    autoFlashAppliedRef.current = false;
    userOverrodeFlashRef.current = false;
    // Reset accessibility consensus/retry state for a fresh scan.
    accessibilityRetryRef.current = 0;
    paidOcrCountRef.current = 0;
    lotSeenCountRef.current.clear();
    lastIntraAgreementRef.current = 0;
    lastLotRef.current = '';
    lastCoachingAtRef.current = 0;
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
  }, []);

  const triggerCaptureFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.45, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start();
  }, [flashAnim]);

  const handleCapture = useCallback(
    async (uri: string | string[]) => {
      // Le lot peut être scanné SANS marque : l'utilisateur a sauté l'étape
      // marque (bouton Passer) ou le code-barres n'a pas résolu de marque.
      // performOcr et le matching de rappel fonctionnent sans marque (param
      // optionnel) et la confirmation retombe sur "Unknown". On ne bloque donc
      // plus l'OCR ici — sinon la capture flashe mais l'analyse ne démarre jamais.
      lotMutation.mutate(uri);
    },
    [lotMutation]
  );

  const isProcessing = lotMutation.isPending || isFinalizing;
  // Libellé par étape : ML Kit (rapide) → Vision (renforcé) → Claude (approfondi).
  const processingLabel =
    ocrStage === 'vision'
      ? t('scan.stageVision')
      : ocrStage === 'claude'
        ? t('scan.stageClaude')
        : t('scan.lotAnalyzing');

  const handlePreviewOcrText = useCallback(
    (text: string) => {
      if (lotInFrameAnnouncedRef.current || isProcessing) return;
      if (!detectLotLike(text)) return;
      lotInFrameAnnouncedRef.current = true;
      if (accessibilityMode) {
        speak(t('accessibility.voice.lotInFrame'), { priority: true });
      }
      const delayMs = accessibilityMode ? AUTO_CAPTURE_DELAY_VOICE_MS : AUTO_CAPTURE_DELAY_SIGHTED_MS;
      if (autoCaptureTimerRef.current) clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = setTimeout(() => {
        autoCaptureTimerRef.current = null;
        if (!isProcessingRef.current) {
          triggerCaptureFeedback();
          scannerRef.current?.triggerCapture();
        }
      }, delayMs);
    },
    [accessibilityMode, isProcessing, speak, t, triggerCaptureFeedback]
  );

  const handleLowLight = useCallback(
    (isLow: boolean) => {
      if (!isLow) return;
      // On NE déclenche PLUS le flash automatiquement : sur une boîte de conserve
      // (surface réfléchissante) le flash crée des reflets qui empêchent l'OCR de
      // lire le lot. Le flash reste disponible manuellement via le bouton.
      if (accessibilityMode) {
        speak(t('accessibility.voice.lowLight'), { priority: true, dedupeMs: 12000 });
      }
    },
    [accessibilityMode, speak, t]
  );

  const handleVoiceCommand = useCallback(
    (command: 'photo' | 'flash_on' | 'flash_off') => {
      if (command === 'photo') {
        if (!isProcessingRef.current) {
          if (accessibilityMode) {
            speak(t('accessibility.voice.photoCommand'), { priority: true });
          }
          triggerCaptureFeedback();
          scannerRef.current?.triggerCapture();
        }
        return;
      }
      if (command === 'flash_on') {
        scannerRef.current?.setFlash(true);
        userOverrodeFlashRef.current = false;
        if (accessibilityMode) {
          speak(t('accessibility.voice.flashOn'), { priority: true });
        }
        return;
      }
      if (command === 'flash_off') {
        scannerRef.current?.setFlash(false);
        userOverrodeFlashRef.current = true;
        if (accessibilityMode) {
          speak(t('accessibility.voice.flashOff'), { priority: true });
        }
      }
    },
    [accessibilityMode, speak, t, triggerCaptureFeedback]
  );

  isProcessingRef.current = isProcessing;

  useEffect(() => {
    return () => {
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, []);

  // Micro COUPÉ : sur iOS, la reconnaissance vocale (micro) en continu se bat
  // avec la synthèse pour la session audio → le guidage vocal était tronqué.
  // On désactive donc les commandes vocales ici ; l'auto-capture mains-libres
  // (détection + secours 3s/5s) remplace la commande "photo". Le guidage vocal
  // reste, et il est désormais net.
  useVoiceCommands(false, {
    onCommand: handleVoiceCommand,
    onError: (code) => {
      if (code !== 'no-speech') {
        console.warn('[ScanLotScreen] voice command error:', code);
      }
    }
  });

  const handleConfirm = useCallback(async () => {
    const finalLot = isEditingLot ? editedLot.trim().toUpperCase() : lotNumber;
    const normalizedOcrText = normalizeLotValue(ocrText || '');
    // Purge the garbage: once a lot is confirmed, match recalls against ONLY that
    // lot — not the noisy OCR candidate list — so a partial/misread token can
    // never coincidentally match a recall and raise a false "DO NOT CONSUME".
    const candidatesForMatch = [finalLot]
      .filter(Boolean)
      .map((candidate) => normalizeLotValue(candidate));

    if (!finalLot) {
      setErrorMessage(t('scan.errors.lotExtractFailed'));
      setConfirmModalVisible(false);
      return;
    }

    // Allow empty brand (user skipped brand step) - will be set to "Unknown"
    const finalBrand = brand && brand.trim() ? brand.trim() : t('common.unknown');

    const hasQuota = await ensureScanQuota();
    if (!hasQuota) {
      setConfirmModalVisible(false);
      return;
    }

    setIsFinalizing(true);

    try {
      const validation = await validateLotAgainstBrandPatterns(finalBrand, finalLot);

      if (validation.isValid) {
        console.log(`[ScanLotScreen] Lot ${finalLot} validated against existing patterns for ${finalBrand}`);
      } else {
        console.log(`[ScanLotScreen] New lot pattern detected for ${finalBrand}: ${finalLot}`);
        await saveLotPattern(finalBrand, finalLot);
      }

      const recallList = await fetchRecallsByCountry(country);
      const product = await addProduct({
        brand: finalBrand,
        lotNumber: finalLot,
        ...(productName && { productName }),
        ...(productImage && { productImage })
      });

      const matchingRecalls = recallList.filter((recall) => {
        // Skip recalls without lot numbers — brand-only matching is too unreliable
        if (!recall.lotNumbers || recall.lotNumbers.length === 0) {
          return false;
        }

        // Check if brand matches (required for partial lot matching)
        const brandLower = finalBrand.toLowerCase();
        const recallBrandLower = (recall.brand || '').toLowerCase();
        const isBrandMatch = brandLower === recallBrandLower ||
          (brandLower.length >= 3 && recallBrandLower.includes(brandLower)) ||
          (recallBrandLower.length >= 3 && brandLower.includes(recallBrandLower));

        const lotMatch = recall.lotNumbers.some((lot) => {
          const normalizedRecallLot = normalizeLotValue(lot);
          if (!normalizedRecallLot || normalizedRecallLot.length < 3) {
            return false;
          }

          return candidatesForMatch.some((candidate) => {
            if (!candidate || candidate.length < 3) return false;

            // Exact match (always accepted)
            if (candidate === normalizedRecallLot) return true;

            // Partial match only if brand also matches AND shorter string is at least 6 chars
            if (isBrandMatch) {
              const shorter = candidate.length <= normalizedRecallLot.length ? candidate : normalizedRecallLot;
              const longer = candidate.length > normalizedRecallLot.length ? candidate : normalizedRecallLot;
              return shorter.length >= 6 && longer.includes(shorter);
            }

            return false;
          });
        });

        return lotMatch;
      });

      if (matchingRecalls.length === 0) {
        // No recalls found — mark product as safe immediately
        // (signature FR : (product, changes, recalls), pas (id, updates))
        await updateProduct(
          product,
          { recallStatus: 'safe', lastCheckedAt: Date.now() },
          recallList
        );
      } else {
        await updateRecall(product, matchingRecalls);
      }

      if (matchingRecalls.length > 0) {
        // Send immediate notification when recall is detected
        console.log(`[ScanLotScreen] Recall detected! Sending notification for ${finalBrand} - ${finalLot}`);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 ALERTE PRODUIT RAPPELÉ',
            body: `⚠️ ${finalBrand} - Lot ${finalLot}\n\n🚫 NE PAS CONSOMMER\nCe produit fait l'objet d'un rappel sanitaire.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 250, 250, 250],
            data: {
              productId: product.id,
              type: 'immediate-recall-alert',
              brand: finalBrand,
              lotNumber: finalLot
            }
          },
          trigger: null // Send immediately
        });
      }

      incrementScans();

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
    country,
    lotNumber,
    isEditingLot,
    editedLot,
    ocrText,
    lotCandidates,
    productName,
    productImage,
    ensureScanQuota,
    incrementScans,
    resetFlow,
    router,
    t,
    updateRecall,
    updateProduct
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
    setVerifiedAt(null);
    setScannerResetToken((token) => token + 1);
    lotInFrameAnnouncedRef.current = false;
    autoFlashAppliedRef.current = false;
    userOverrodeFlashRef.current = false;
    accessibilityRetryRef.current = 0;
    paidOcrCountRef.current = 0;
    lotSeenCountRef.current.clear();
    lastIntraAgreementRef.current = 0;
    lastLotRef.current = '';
    lastCoachingAtRef.current = 0;
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
  }, []);

  const handleEditLot = useCallback(() => {
    setEditedLot(lotNumber || '');
    setIsEditingLot(true);
  }, [lotNumber]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingLot(false);
    setEditedLot('');
  }, []);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleManualEntry = useCallback(() => {
    setEditedLot('');
    setIsEditingLot(true);
    setConfirmModalVisible(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      setScannerResetToken((token) => token + 1);
      // Fresh scan session → reset accessibility consensus/retry state.
      accessibilityRetryRef.current = 0;
      paidOcrCountRef.current = 0;
      lotSeenCountRef.current.clear();
      lastIntraAgreementRef.current = 0;
      lastLotRef.current = '';
      lastCoachingAtRef.current = 0;
      if (accessibilityMode) {
        speak(t('accessibility.voice.scanLotReady'), { priority: true });
      }
      // En quittant l'écran : on coupe le focus ET on annule tout timer de
      // capture en attente → AUCUNE capture/boucle après être sorti de la page.
      return () => {
        isScreenFocusedRef.current = false;
        if (fallbackCaptureTimerRef.current) {
          clearTimeout(fallbackCaptureTimerRef.current);
          fallbackCaptureTimerRef.current = null;
        }
        if (autoCaptureTimerRef.current) {
          clearTimeout(autoCaptureTimerRef.current);
          autoCaptureTimerRef.current = null;
        }
      };
    }, [accessibilityMode, speak, t])
  );

  // Blind users: re-announce the lot-scan intro when the app returns to the
  // foreground (useFocusEffect doesn't fire on background→active), so the voice
  // guidance doesn't go silent after switching apps and coming back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (
        prev.match(/inactive|background/) &&
        next === 'active' &&
        accessibilityMode &&
        isScreenFocusedRef.current &&
        !isProcessingRef.current &&
        !isConfirmModalVisible
      ) {
        speak(t('accessibility.voice.scanLotReady'), { priority: true });
      }
    });
    return () => sub.remove();
  }, [accessibilityMode, speak, t, isConfirmModalVisible]);

  // Auto-capture de secours (mains libres) : si la pré-détection par preview
  // n'a rien donné au bout de quelques secondes (étiquette peu contrastée,
  // faible lumière sans flash, impression point-matrice), on force une capture
  // pleine résolution qui déclenche l'OCR complet (ML Kit + Vision + Claude).
  // Indispensable pour l'accessibilité : un malvoyant ne peut pas viser un
  // bouton. Ré-armé à chaque (ré)init du scanner (focus, "Recommencer").
  useEffect(() => {
    lotInFrameAnnouncedRef.current = false;
    const delayMs = accessibilityMode ? 5000 : 3000;
    if (fallbackCaptureTimerRef.current) clearTimeout(fallbackCaptureTimerRef.current);
    fallbackCaptureTimerRef.current = setTimeout(() => {
      if (!lotInFrameAnnouncedRef.current && !isProcessingRef.current) {
        lotInFrameAnnouncedRef.current = true;
        triggerCaptureFeedback();
        scannerRef.current?.triggerCapture();
      }
    }, delayMs);
    return () => {
      if (fallbackCaptureTimerRef.current) {
        clearTimeout(fallbackCaptureTimerRef.current);
        fallbackCaptureTimerRef.current = null;
      }
    };
  }, [scannerResetToken, accessibilityMode, triggerCaptureFeedback]);

  return (
    <GradientBackground>
      <Scanner
        ref={scannerRef}
        onCapture={handleCapture}
        enableBarcodeScanning={false}
        isProcessing={isProcessing}
        mode="band"
        resetToken={scannerResetToken}
        flashPosition="top-right"
        multiFrameCount={accessibilityMode ? 4 : 3}
        multiFrameDelayMs={accessibilityMode ? 250 : 200}
        onBack={handleGoBack}
        onRestart={handleRestart}
        onManualEntry={handleManualEntry}
        previewOcrEnabled
        onPreviewOcrText={handlePreviewOcrText}
        lowLightDetectionEnabled
        onLowLight={handleLowLight}
        hideCaptureButton
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.shutterFlash, { opacity: flashAnim }]}
      />

      <ScrollView style={styles.feedback} contentContainerStyle={styles.feedbackContent}>
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
            {isProcessing ? processingLabel : t('scan.lotInstruction')}
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

        {lotNumber && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('scan.detectedLot')}</Text>
            <Text style={[styles.lotText, { color: colors.accent }]}>{lotNumber}</Text>
          </>
        )}

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

      <ResultBottomNav />

      <Modal
        visible={isConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('scan.confirmLotTitle')}
            </Text>

            {isEditingLot ? (
              <>
                <Text style={[styles.modalMessage, { color: colors.textSecondary, marginTop: 12 }]}>
                  {t('scanLot.editManually')}
                </Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.accent }]}
                  value={editedLot}
                  onChangeText={setEditedLot}
                  placeholder={t('scanLot.enterLot')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  autoFocus
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                    onPress={handleCancelEdit}
                    disabled={isFinalizing}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.accent }]}
                    onPress={handleConfirm}
                    disabled={isFinalizing}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.onAccent }]}>
                      {t('scan.validate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                  {t('scanLot.ocrDetected')}
                </Text>
                <View style={[styles.ocrTextContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.ocrText, { color: colors.textPrimary }]}>
                    {lotNumber || t('scanLot.noText')}
                  </Text>
                </View>

                {ocrSource && (
                  <View style={[styles.ocrSourceContainer, { backgroundColor: ocrSource === 'vision-fallback' ? '#e8f5e9' : '#e3f2fd' }]}>
                    <Text style={[styles.ocrSourceText, { color: ocrSource === 'vision-fallback' ? '#2e7d32' : '#1565c0' }]}>
                      {ocrSource === 'vision-fallback' ? t('scanLot.ocrSourceVision') : ocrSource === 'mlkit' ? t('scanLot.ocrSourceMlKit') : t('scanLot.ocrSource', { source: ocrSource })}
                    </Text>
                    {verifiedAt && (
                      <Text style={[styles.recallMeta, { color: colors.textSecondary }]}>
                        {t('productCard.scannedAt', {
                          date: new Date(verifiedAt).toLocaleDateString(locale || undefined),
                          time: new Date(verifiedAt).toLocaleTimeString(locale || undefined, {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        })}
                      </Text>
                    )}
                    <Text style={[styles.recallDisclaimer, { color: colors.textSecondary }]}>
                      {t('common.noRecallDisclaimer')}
                    </Text>
                  </View>
                )}

                {isCheckingRecall && (
                  <View style={styles.checkingContainer}>
                    <Text style={[styles.checkingText, { color: colors.textSecondary }]}>
                      ðŸ” {t('scanLot.checkingRecalls')}
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
                        ? matchedLot ? t('scanLot.recallDetectedWithLot', { lot: matchedLot }) : t('scanLot.recallDetected')
                        : t('scanLot.productSafe')}
                    </Text>
                  </View>
                )}


                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}
                  onPress={handleEditLot}
                >
                  <Text style={[styles.editButtonText, { color: colors.accent }]}>
                    {t('scanLot.edit')}
                  </Text>
                </TouchableOpacity>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => { setConfirmModalVisible(false); resetFlow(); }}
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
                    <Text style={[styles.modalButtonText, { color: colors.onAccent }]}>
                      {t('scan.validate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
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
    paddingBottom: 48,
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
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 8,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top'
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
  recallMeta: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center'
  },
  recallDisclaimer: {
    marginTop: 6,
    fontSize: 12,
    fontStyle: 'italic',
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
  scanCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12
  },
  scanCounterLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  scanCounterValue: {
    fontSize: 18,
    fontWeight: '800'
  },
  shutterFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 20
  }
});
