import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { setCaptureDiag } from '../services/ocrService';

type ScannerMode = 'barcode' | 'photo' | 'band';

export type CoachingHint = 'blur' | 'tooFar' | 'tooClose';

export type ScannerHandle = {
  triggerCapture: () => Promise<void>;
  setFlash: (on: boolean) => void;
  isFlashOn: () => boolean;
};

type ScannerProps = {
  onCapture: (uri: string | string[]) => Promise<void> | void;
  onBarcodeScanned?: (barcode: string) => void;
  // Capture multi-frames : prend N photos par déclenchement (rafale) pour que
  // l'OCR puisse choisir la meilleure (plus robuste sur photo floue/bougée).
  multiFrameCount?: number;
  multiFrameDelayMs?: number;
  isProcessing?: boolean;
  enableBarcodeScanning?: boolean;
  mode?: ScannerMode;
  resetToken?: number;
  enableFlashToggle?: boolean;
  aiMessage?: string;
  onSkip?: () => void;
  onReload?: () => void;
  onManualEntry?: () => void;
  onBack?: () => void;
  onRestart?: () => void;
  flashPosition?: 'top-left' | 'top-right';
  previewOcrEnabled?: boolean;
  previewOcrIntervalMs?: number;
  onPreviewOcrText?: (text: string) => void;
  lowLightDetectionEnabled?: boolean;
  onLowLight?: (isLow: boolean) => void;
  onCoachingHint?: (hint: CoachingHint) => void;
  hideCaptureButton?: boolean;
};

const DEFAULT_PREVIEW_OCR_INTERVAL_MS = 1800;
const LOW_LIGHT_EMPTY_THRESHOLD = 3;

export const Scanner = forwardRef<ScannerHandle, ScannerProps>(function Scanner(
  {
    onCapture,
    onBarcodeScanned,
    multiFrameCount = 1,
    multiFrameDelayMs = 200,
    isProcessing = false,
    enableBarcodeScanning = false,
    mode = 'photo',
    resetToken,
    enableFlashToggle = true,
    aiMessage,
    onSkip,
    onReload,
    onManualEntry,
    onBack,
    onRestart,
    flashPosition = 'top-left',
    previewOcrEnabled = false,
    previewOcrIntervalMs = DEFAULT_PREVIEW_OCR_INTERVAL_MS,
    onPreviewOcrText,
    lowLightDetectionEnabled = false,
    onLowLight,
    onCoachingHint,
    hideCaptureButton = false
  },
  ref
) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Quand l'écran n'est plus au premier plan (navigation vers Réglages, etc.),
  // on coupe la caméra, la boucle OCR de prévisualisation et la torche — sinon
  // l'auto-capture et le flash continuent de se déclencher sur les autres pages.
  const isFocused = useIsFocused();
  // Décalage sûr pour les boutons du haut : sous la barre d'état / Dynamic
  // Island. Sans ça, sur iPhone à encoche, le bouton retour tombe sous la
  // status bar et iOS intercepte le tap → impossible de revenir en arrière.
  const topInset = insets.top + 8;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  // Résolution de capture : sans pictureSize, iOS capture en basse résolution
  // (~1100px observé) → les codes de lot pâles deviennent illisibles. On force la
  // plus grande taille dispo à l'init pour avoir une vraie photo ~12 Mpx.
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  const flashOnRef = useRef(flashOn);
  flashOnRef.current = flashOn;

  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  const previewOcrLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewOcrInFlightRef = useRef(false);
  const emptyOcrStreakRef = useRef(0);
  const lowLightActiveRef = useRef(false);
  const lastCoachingHintRef = useRef<{ hint: CoachingHint; at: number } | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Camera mounting = exactly the FR app's approach (it works reliably on iOS):
  // the CameraView is ALWAYS mounted with `active={isFocused}`, so the backgrounded
  // screen releases the single iOS camera session and the focused one reacquires it.
  // NO activation delay, NO black placeholder, NO throwaway "prime" capture — those
  // US-only workarounds were what stopped the lot capture from feeding the OCR on
  // iPhone. Barcode mode additionally remounts via `key={bc-${resetToken}}` (below)
  // for fresh re-detection on return; lot mode keeps the same session (no freeze on
  // "Recommencer"). `cameraReady` is never reset on blur → it stays true across focus
  // (the lot camera is not remounted), so capture works immediately on return.

  const handleBarcodeScanned = useCallback(
    (scanningResult: BarcodeScanningResult) => {
      // !isFocused : on ne traite plus les codes-barres quand l'écran n'est pas
      // au premier plan (ex. on est passé à l'écran de scan de lot) — sinon la
      // caméra (toujours montée) continue de scanner en arrière-plan et peut
      // relancer une navigation en boucle.
      if (!enableBarcodeScanning || isProcessing || !isFocused || !onBarcodeScanned) {
        return;
      }
      const barcode = scanningResult.data;
      if (barcode && barcode !== scannedBarcode) {
        console.log('[Scanner] Barcode scanned:', barcode);
        // Vibration de confirmation dès qu'un code-barres est détecté.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setScannedBarcode(barcode);
        onBarcodeScanned(barcode);
      }
    },
    [enableBarcodeScanning, isProcessing, isFocused, onBarcodeScanned, scannedBarcode]
  );

  // À l'init de la caméra : récupère la plus grande taille de capture disponible
  // et la fige (pictureSize) pour des photos pleine résolution. Hors code-barres
  // (qui n'a pas besoin de haute résolution photo et où changer la session est risqué).
  const handleCameraReady = useCallback(async () => {
    setCameraReady(true);
    if (enableBarcodeScanning) return;
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync?.();
      console.log('[Capture] available picture sizes:', JSON.stringify(sizes));
      if (Array.isArray(sizes) && sizes.length > 0) {
        // iOS : les vrais presets sont des NOMS ("Photo" = pleine résolution 4:3 =
        // pleine largeur du capteur). Les valeurs numériques type "3840x2160" sont
        // des presets VIDÉO qu'iOS rend en ~CARRÉ (logs : on demandait 3840x2160 et
        // la capture sortait en 2224x2160 → côtés du code coupés). On privilégie
        // donc "Photo" (puis "High") s'ils existent.
        const namedPhoto = sizes.find((s) => /^photo$/i.test(String(s)))
          ?? sizes.find((s) => /^high$/i.test(String(s)));

        // Sinon (Android) : plus grande taille au format LARGE (4:3/16:9, ratio
        // ≥ 1.2) pour garder toute la largeur ; repli sur surface max.
        let best: string | undefined;
        let bestWideArea = 0;
        let bestAnyArea = 0;
        let bestAny: string | undefined;
        for (const s of sizes) {
          const m = String(s).match(/(\d+)\s*[x×]\s*(\d+)/);
          if (!m) continue;
          const w = Number(m[1]);
          const h = Number(m[2]);
          const area = w * h;
          const ratio = Math.max(w, h) / Math.min(w, h);
          if (area > bestAnyArea) {
            bestAnyArea = area;
            bestAny = s;
          }
          if (ratio >= 1.2 && area > bestWideArea) {
            bestWideArea = area;
            best = s;
          }
        }
        const chosen = namedPhoto ?? best ?? bestAny;
        console.log('[Capture] chosen pictureSize:', chosen, '(named:', namedPhoto, 'wide:', best, ')');
        // SDK 54 / expo-camera 17 : pictureSize fonctionne normalement et donne du
        // 4:3 pleine résolution (comme FR). On l'applique donc sur les DEUX
        // plateformes ("Photo" = pleine résolution 4:3 sur iOS). Le bug de capture
        // carrée était spécifique à expo-camera 55.
        const applied = chosen;
        // Remonté aux logs cloud d'OCR pour confirmer le format de capture sans
        // logs appareil (cf. setCaptureDiag / ocrVision).
        setCaptureDiag(
          `os=${Platform.OS} pictureSizes=${JSON.stringify(sizes)} chosen=${chosen ?? 'none'} applied=${applied ?? 'default'}`
        );
        if (applied) setPictureSize(applied);
      }
    } catch {
      /* getAvailablePictureSizesAsync indispo → on garde le défaut */
    }
  }, [enableBarcodeScanning]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isProcessingRef.current || !cameraReady) {
      return;
    }
    // Attendre qu'une snapshot OCR de prévisualisation en cours se libère, puis
    // verrouiller : sinon la rafale et la boucle OCR se télescopent sur
    // takePictureAsync (capture qui échoue/bloque, scan qui ne se déclenche pas).
    let waited = 0;
    while (previewOcrInFlightRef.current && waited < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waited += 100;
    }
    previewOcrInFlightRef.current = true;
    try {
      // Rafale de N photos (multiFrameCount) : l'OCR choisira la meilleure.
      // Capture directe comme l'app FR : on pousse la frame dès qu'on a un uri,
      // sans contrôle de taille / re-capture "anti-noir" (ce contrôle rejetait
      // des captures légitimes < 20 Ko → uris vide → l'OCR ne se lançait jamais).
      const frameCount = Math.max(1, multiFrameCount);
      const uris: string[] = [];
      for (let i = 0; i < frameCount; i++) {
        if (!cameraRef.current) break;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 1.0,
            skipProcessing: false,
            shutterSound: false
          });
          if (photo?.uri) {
            console.log(`[Capture] frame ${i + 1}/${frameCount}: ${photo.width}x${photo.height}`);
            uris.push(photo.uri);
          }
        } catch (frameError) {
          console.warn(`Capture frame ${i + 1}/${frameCount} failed`, frameError);
        }
        if (i < frameCount - 1 && multiFrameDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, multiFrameDelayMs));
        }
      }
      if (uris.length > 0) {
        // Une seule frame → on garde la signature uri:string (rétrocompat).
        await onCapture(uris.length === 1 ? uris[0] : uris);
      }
    } catch (error) {
      console.warn('Capture failed', error);
    } finally {
      previewOcrInFlightRef.current = false;
    }
  }, [cameraReady, onCapture, multiFrameCount, multiFrameDelayMs]);

  const emitCoachingHint = useCallback(
    (hint: CoachingHint) => {
      if (!onCoachingHint) return;
      const now = Date.now();
      const last = lastCoachingHintRef.current;
      if (last && last.hint === hint && now - last.at < 4000) return;
      lastCoachingHintRef.current = { hint, at: now };
      onCoachingHint(hint);
    },
    [onCoachingHint]
  );

  const runPreviewOcrTick = useCallback(async () => {
    if (previewOcrInFlightRef.current) return;
    if (isProcessingRef.current) return;
    if (!cameraRef.current) return;

    previewOcrInFlightRef.current = true;
    let snapshotUri: string | null = null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        skipProcessing: true,
        shutterSound: false,
        exif: false
      });
      if (!photo?.uri) return;
      snapshotUri = photo.uri;

      const result = await TextRecognition.recognize(photo.uri);
      const text = (result?.text ?? '').trim();

      if (lowLightDetectionEnabled && onLowLight) {
        if (text.length === 0) {
          emptyOcrStreakRef.current += 1;
          if (
            !lowLightActiveRef.current &&
            emptyOcrStreakRef.current >= LOW_LIGHT_EMPTY_THRESHOLD
          ) {
            lowLightActiveRef.current = true;
            onLowLight(true);
          }
        } else {
          emptyOcrStreakRef.current = 0;
          if (lowLightActiveRef.current) {
            lowLightActiveRef.current = false;
            onLowLight(false);
          }
        }
      }

      if (onCoachingHint && text.length > 0 && photo.width) {
        if (text.length < 5) {
          emitCoachingHint('tooFar');
        } else {
          const widestBlock = result.blocks.reduce((max, b) => {
            const w = b.frame?.width ?? 0;
            return w > max ? w : max;
          }, 0);
          if (widestBlock > 0 && widestBlock > photo.width * 0.85) {
            emitCoachingHint('tooClose');
          }
        }
      }

      if (text.length > 0 && onPreviewOcrText) {
        onPreviewOcrText(text);
      }
    } catch (error) {
      // ML Kit failures on partial frames are expected — don't spam logs.
    } finally {
      previewOcrInFlightRef.current = false;
      // Supprimer la snapshot d'aperçu (comme l'app FR) : une photo toutes les
      // ~1,8 s sinon s'accumule pendant le scan continu → pression stockage.
      if (snapshotUri) {
        try {
          await FileSystem.deleteAsync(snapshotUri, { idempotent: true });
        } catch {
          /* noop */
        }
      }
    }
  }, [emitCoachingHint, lowLightDetectionEnabled, onCoachingHint, onLowLight, onPreviewOcrText]);

  useEffect(() => {
    if (!previewOcrEnabled || !cameraReady || !isFocused) {
      if (previewOcrLoopRef.current) {
        clearTimeout(previewOcrLoopRef.current);
        previewOcrLoopRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      previewOcrLoopRef.current = setTimeout(async () => {
        await runPreviewOcrTick();
        if (!cancelled) schedule();
      }, previewOcrIntervalMs);
    };
    schedule();

    return () => {
      cancelled = true;
      if (previewOcrLoopRef.current) {
        clearTimeout(previewOcrLoopRef.current);
        previewOcrLoopRef.current = null;
      }
    };
  }, [previewOcrEnabled, cameraReady, isFocused, previewOcrIntervalMs, runPreviewOcrTick]);

  useEffect(() => {
    // Réinitialisation d'un nouveau scan SANS remonter la caméra : on garde la
    // session vivante (un remount de CameraView fige la caméra sur iOS lors d'un
    // "Recommencer"). On ne remet donc PAS cameraReady à false — la caméra reste
    // prête (onCameraReady ne se redéclenchera pas sans remontage).
    setScannedBarcode(null);
    setFlashOn(false);
    emptyOcrStreakRef.current = 0;
    lowLightActiveRef.current = false;
    lastCoachingHintRef.current = null;
  }, [resetToken]);

  useImperativeHandle(
    ref,
    () => ({
      triggerCapture: handleCapture,
      setFlash: (on: boolean) => setFlashOn(on),
      isFlashOn: () => flashOnRef.current
    }),
    [handleCapture]
  );

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>
          {t('scanner.cameraLoading')}
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    // iOS ne réaffiche pas le prompt système une fois la permission refusée
    // (canAskAgain === false) : on renvoie alors vers les Réglages du téléphone.
    const handlePermissionPress = permission.canAskAgain
      ? requestPermission
      : () => Linking.openSettings();
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color={colors.accent} style={{ marginBottom: 16 }} />
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>
          {permission.canAskAgain
            ? t('scanner.cameraPermissionNeeded')
            : t('scanner.cameraPermissionDenied')}
        </Text>
        <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.accent }]} onPress={handlePermissionPress}>
          <Text style={[styles.permissionButtonText, { color: colors.surface }]}>
            {permission.canAskAgain ? t('scanner.allowCamera') : t('scanner.openSettings')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showCapture = (mode === 'photo' || mode === 'band') && !hideCaptureButton;

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        {/* Caméra TOUJOURS montée (approche FR), `active={isFocused}` gère la
            libération/réacquisition de la session iOS. Pas de placeholder noir. */}
        <CameraView
          // En mode CODE-BARRES seulement : on remonte la caméra à chaque
          // (re)focus (resetToken est incrémenté au focus) pour repartir sur une
          // session fraîche qui re-détecte le code (sinon, au retour de l'écran
          // lot, la session interrompue ne rescanne plus). En mode LOT, pas de
          // key → jamais de remontage (évite le freeze "Recommencer").
          key={enableBarcodeScanning ? `bc-${resetToken}` : undefined}
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          // PAS de prop `mode`/`autofocus` : les défauts d'expo-camera font déjà un
          // autofocus continu net (prouvé par l'écran code-barres). Forcer
          // autofocus="on" verrouillait/dégradait le focus sur l'écran lot (preview
          // floue). Le gain de lecture vient du crop pleine résolution, pas du focus.
          // active={isFocused} : l'écran en arrière-plan LIBÈRE la session caméra
          // (iOS n'autorise qu'une caméra active) → l'écran de lot peut l'obtenir.
          // Pas de freeze de reprise sur le code-barres car il remonte une caméra
          // fraîche au focus (key ci-dessus) ; l'écran lot ne remonte pas.
          active={isFocused}
          // Photo pleine résolution (hors code-barres) : sans ça iOS capture en
          // basse résolution → codes de lot pâles illisibles.
          pictureSize={enableBarcodeScanning ? undefined : pictureSize}
          flash={flashOn && isFocused ? 'on' : 'off'}
          enableTorch={flashOn && isFocused}
          onCameraReady={handleCameraReady}
          barcodeScannerSettings={
            enableBarcodeScanning
              ? {
                  barcodeTypes: [
                    'qr',
                    'ean13',
                    'ean8',
                    'upc_a',
                    'upc_e',
                    'code128',
                    'code39',
                    'code93',
                    'codabar',
                    'itf14',
                    'aztec',
                    'pdf417',
                    'datamatrix'
                  ]
                }
              : undefined
          }
          onBarcodeScanned={enableBarcodeScanning ? handleBarcodeScanned : undefined}
        />

        {/* Back button */}
        {onBack && (
          <TouchableOpacity
            style={[styles.backButtonTop, { backgroundColor: 'rgba(0,0,0,0.5)', top: topInset }]}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
        )}

        {/* Flash button */}
        {enableFlashToggle && (
          <TouchableOpacity
            style={[flashPosition === 'top-right' ? styles.flashButtonTopRight : styles.flashButtonTop, { top: topInset }]}
            onPress={() => setFlashOn((prev) => !prev)}
            disabled={!cameraReady}
          >
            <View style={[styles.flashIconContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Ionicons
                name={flashOn ? 'flash' : 'flash-off'}
                size={22}
                color={flashOn ? '#FFD700' : colors.surface}
              />
              {flashOn && <View style={styles.flashActiveDot} />}
            </View>
          </TouchableOpacity>
        )}

        {/* Reload button */}
        {onReload && (
          <TouchableOpacity
            style={[styles.reloadButtonCamera, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={onReload}
          >
            <Ionicons name="refresh" size={24} color={colors.surface} />
          </TouchableOpacity>
        )}

        {/* Manual entry button */}
        {onManualEntry && (
          <TouchableOpacity
            style={[styles.manualEntryButtonCamera, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={onManualEntry}
          >
            <Ionicons name="create-outline" size={22} color={colors.surface} />
          </TouchableOpacity>
        )}

        {/* Restart button */}
        {onRestart && (
          <TouchableOpacity
            style={[styles.restartButtonCamera, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={onRestart}
          >
            <Ionicons name="refresh-circle" size={28} color={colors.surface} />
          </TouchableOpacity>
        )}

        {/* Skip button */}
        {onSkip && (
          <TouchableOpacity
            style={[styles.skipButtonCamera, { backgroundColor: colors.accent }]}
            onPress={onSkip}
          >
            <Text style={[styles.skipButtonText, { color: colors.surface }]}>{t('scanner.skip')}</Text>
            <Ionicons name="play-skip-forward" size={18} color={colors.surface} />
          </TouchableOpacity>
        )}

        <View pointerEvents="none" style={styles.tipContainer}>
          <View style={styles.tipBubble}>
            <Ionicons name="information-circle-outline" size={16} color="#FFF" />
            <Text style={styles.tipText}>
              {mode === 'barcode'
                ? t('scanner.tipBarcode')
                : mode === 'band'
                  ? t('scanner.tipBand')
                  : t('scanner.tipPhoto')}
            </Text>
          </View>
        </View>

        <View pointerEvents="none" style={styles.overlay}>
          {mode === 'barcode' ? (
            <View style={styles.barcodeTarget}>
              <View style={[styles.corner, styles.topLeft, { borderColor: colors.accent }]} />
              <View style={[styles.corner, styles.topRight, { borderColor: colors.accent }]} />
              <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.accent }]} />
              <View style={[styles.corner, styles.bottomRight, { borderColor: colors.accent }]} />
            </View>
          ) : mode === 'band' ? (
            <>
              <View style={[styles.bandFrame, { borderColor: colors.accent }]}>
                <View style={[styles.bandCorner, styles.bandTopLeft, { borderColor: colors.accent }]} />
                <View style={[styles.bandCorner, styles.bandTopRight, { borderColor: colors.accent }]} />
                <View style={[styles.bandCorner, styles.bandBottomLeft, { borderColor: colors.accent }]} />
                <View style={[styles.bandCorner, styles.bandBottomRight, { borderColor: colors.accent }]} />
              </View>
              {aiMessage && (
                <View style={[styles.aiMessageContainer, { backgroundColor: 'rgba(46, 125, 50, 0.9)' }]}>
                  <Ionicons name="sparkles" size={14} color="#FFF" />
                  <Text style={[styles.aiMessageText, { color: colors.surface }]}>
                    {aiMessage}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.frame, { borderColor: colors.accent }]} />
          )}
        </View>
      </View>

      {showCapture && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.captureButton, { borderColor: colors.surface, backgroundColor: 'rgba(0,0,0,0.3)' }]}
            onPress={handleCapture}
            disabled={!cameraReady || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Ionicons name="camera" size={28} color={colors.surface} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  cameraWrapper: {
    flex: 1
  },
  camera: {
    ...StyleSheet.absoluteFillObject
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  frame: {
    width: '75%',
    aspectRatio: 1,
    borderWidth: 3,
    borderRadius: 24
  },
  barcodeTarget: {
    width: 280,
    height: 280,
    position: 'relative'
  },
  bandFrame: {
    width: '90%',
    height: '22%',
    borderWidth: 3,
    borderRadius: 14,
    position: 'relative'
  },
  bandCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderWidth: 4
  },
  bandTopLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0
  },
  bandTopRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0
  },
  bandBottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0
  },
  bandBottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0
  },
  corner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderWidth: 4
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0
  },
  controls: {
    position: 'absolute',
    bottom: 32,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flashButtonTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10
  },
  flashIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  flashActiveDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700'
  },
  flashButtonTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10
  },
  backButtonTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    zIndex: 10
  },
  restartButtonCamera: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    zIndex: 10
  },
  skipButtonCamera: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    zIndex: 10
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  reloadButtonCamera: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    zIndex: 10
  },
  manualEntryButtonCamera: {
    position: 'absolute',
    bottom: 20,
    left: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    zIndex: 10
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 16,
    lineHeight: 24
  },
  permissionButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  aiMessageContainer: {
    position: 'absolute',
    bottom: -60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: '80%'
  },
  aiMessageText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18
  },
  tipContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5
  },
  tipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    maxWidth: '85%'
  },
  tipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1
  }
});
