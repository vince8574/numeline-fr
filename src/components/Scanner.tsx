import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { LightSensor } from 'expo-sensors';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';

type ScannerMode = 'barcode' | 'photo' | 'band';

type ScannerProps = {
  onCapture: (uri: string | string[]) => Promise<void> | void;
  onBarcodeScanned?: (barcode: string) => void;
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
  /** Active une boucle de snapshots preview envoyés à MLKit (texte trouvé en cadre). */
  previewOcrEnabled?: boolean;
  /** Intervalle en ms entre deux snapshots OCR preview (défaut 1800ms). */
  previewOcrIntervalMs?: number;
  onPreviewOcrText?: (text: string) => void;
  /** Active la détection ambient light via LightSensor (Android). */
  lowLightDetectionEnabled?: boolean;
  /** Seuil en lux en dessous duquel on considère qu'il fait sombre (défaut 30). */
  lowLightThresholdLux?: number;
  onLowLight?: (isLow: boolean) => void;
  /** Nombre de photos à capturer en rafale (défaut 1, recommandé 3 pour OCR multi-frame). */
  multiFrameCount?: number;
  /** Délai en ms entre deux photos en rafale (défaut 200ms). */
  multiFrameDelayMs?: number;
  /** Reçoit des hints de coaching pendant la boucle preview OCR (flou, distance). */
  onCoachingHint?: (hint: 'blur' | 'tooFar' | 'tooClose') => void;
  /** Masque le bouton capture manuel (utile quand l'écran déclenche la capture
   * automatiquement et que le bouton ne sert pas, ex. mode lot avec auto-capture). */
  hideCaptureButton?: boolean;
};

export type ScannerHandle = {
  triggerCapture: () => Promise<void>;
  toggleFlash: () => void;
  setFlash: (on: boolean) => void;
  isFlashOn: () => boolean;
};

export const Scanner = forwardRef<ScannerHandle, ScannerProps>(function Scanner({
  onCapture,
  onBarcodeScanned,
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
  previewOcrIntervalMs = 1800,
  onPreviewOcrText,
  lowLightDetectionEnabled = false,
  lowLightThresholdLux = 30,
  onLowLight,
  multiFrameCount = 1,
  multiFrameDelayMs = 200,
  onCoachingHint,
  hideCaptureButton = false
}, ref) {
  const { colors } = useTheme();
  const { t } = useI18n();
  // La caméra ne doit tenir le matériel que lorsque l'écran qui l'affiche est
  // au premier plan. Sans ça, l'écran précédent (toujours monté dans la pile de
  // navigation) garde la caméra arrière et le nouvel écran n'obtient qu'une
  // preview noire. `active={isFocused}` libère/réacquiert proprement.
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  // Verrou partagé entre handleCapture (manuel/voice) et la boucle preview OCR
  // pour éviter la contention sur cameraRef.takePictureAsync
  const previewOcrBusyRef = useRef(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback(
    (scanningResult: BarcodeScanningResult) => {
      // !isFocused : la caméra reste montée (active={isFocused}), mais on ignore
      // les codes-barres tant que l'écran n'est pas au premier plan (sinon scan
      // en arrière-plan → boucle de navigation).
      if (!enableBarcodeScanning || isProcessing || !isFocused || !onBarcodeScanned) {
        return;
      }

      const barcode = scanningResult.data;

      if (barcode && barcode !== scannedBarcode) {
        console.log('[Scanner] Barcode scanned:', barcode);
        setScannedBarcode(barcode);
        onBarcodeScanned(barcode);
      }
    },
    [enableBarcodeScanning, isProcessing, isFocused, onBarcodeScanned, scannedBarcode]
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isProcessing || !cameraReady) {
      return;
    }

    // Attendre brièvement qu'une éventuelle snapshot preview en cours se libère
    let waited = 0;
    while (previewOcrBusyRef.current && waited < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waited += 100;
    }

    // Verrouiller pour bloquer toute nouvelle snapshot preview pendant la capture
    previewOcrBusyRef.current = true;
    try {
      const frameCount = Math.max(1, multiFrameCount);
      const uris: string[] = [];

      for (let i = 0; i < frameCount; i++) {
        if (!cameraRef.current) break;
        try {
          const photo: any = await cameraRef.current.takePictureAsync({
            quality: 1.0,
            skipProcessing: false,
            shutterSound: i === 0 // son uniquement sur la première
          } as any);
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
        // Si une seule frame, on garde la signature uri:string pour rétrocompatibilité.
        await onCapture(frameCount === 1 ? uris[0] : uris);
      }
    } catch (error) {
      console.warn('Capture failed', error);
    } finally {
      previewOcrBusyRef.current = false;
    }
  }, [cameraReady, isProcessing, onCapture, multiFrameCount, multiFrameDelayMs]);

  useEffect(() => {
    // Réinit d'un nouveau scan SANS remonter la caméra (mode LOT) : on garde la
    // session vivante, donc on ne remet PAS cameraReady à false (sinon le bouton
    // capture / l'auto-capture reste désactivé car onCameraReady ne re-fire pas).
    // En mode code-barres, la caméra est remontée via la key → cameraReady re-fire.
    setScannedBarcode(null);
    setFlashOn(false);
  }, [resetToken]);

  useImperativeHandle(
    ref,
    () => ({
      triggerCapture: handleCapture,
      toggleFlash: () => {
        if (cameraReady) setFlashOn((prev) => !prev);
      },
      setFlash: (on: boolean) => {
        if (cameraReady) setFlashOn(on);
      },
      isFlashOn: () => flashOn
    }),
    [handleCapture, cameraReady, flashOn]
  );

  // Preview OCR loop (snapshot léger -> MLKit -> callback texte + hints coaching)
  const onPreviewOcrTextRef = useRef(onPreviewOcrText);
  onPreviewOcrTextRef.current = onPreviewOcrText;
  const onCoachingHintRef = useRef(onCoachingHint);
  onCoachingHintRef.current = onCoachingHint;

  useEffect(() => {
    if (!previewOcrEnabled || !cameraReady || isProcessing || !isFocused) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    // État local pour le coaching : on émet un hint seulement après plusieurs ticks
    // consistants (évite les flips à chaque frame), et au max une fois toutes les ~6s.
    let noTextStreak = 0;
    let blurStreak = 0;
    let tooCloseStreak = 0;
    let lastHintAt = 0;
    const HINT_COOLDOWN_MS = 6000;

    const emitHint = (hint: 'blur' | 'tooFar' | 'tooClose') => {
      const now = Date.now();
      if (now - lastHintAt < HINT_COOLDOWN_MS) return;
      lastHintAt = now;
      onCoachingHintRef.current?.(hint);
    };

    const tick = async () => {
      if (cancelled || previewOcrBusyRef.current || isProcessing || !cameraRef.current) return;
      previewOcrBusyRef.current = true;
      let snapshotUri: string | null = null;
      try {
        const photo = (await cameraRef.current.takePictureAsync({
          quality: 0.3,
          skipProcessing: true,
          shutterSound: false
        } as any)) as { uri?: string } | null | undefined;
        if (cancelled) return;
        snapshotUri = photo?.uri ?? null;
        if (!snapshotUri) return;

        const result = await TextRecognition.recognize(snapshotUri);
        if (cancelled) return;
        const text = result?.text?.trim() || '';
        if (text && onPreviewOcrTextRef.current) {
          onPreviewOcrTextRef.current(text);
        }

        // Heuristiques de coaching
        if (onCoachingHintRef.current) {
          const compact = text.replace(/\s+/g, '');
          const alnum = (compact.match(/[A-Z0-9]/gi) || []).length;
          const noiseRatio = compact.length === 0 ? 0 : 1 - alnum / compact.length;
          // Le plus long token alphanumérique continu (indicateur de "trop près")
          const longestToken = (text.match(/[A-Z0-9]{1,}/gi) || [])
            .reduce((max, t) => Math.max(max, t.length), 0);

          if (text.length === 0 || alnum < 2) {
            noTextStreak++;
            blurStreak = 0;
            tooCloseStreak = 0;
            // 3 ticks consécutifs sans texte ≈ ~5,4 s : suggère "trop loin"
            if (noTextStreak >= 3) {
              emitHint('tooFar');
              noTextStreak = 0;
            }
          } else if (noiseRatio > 0.4 && alnum >= 3) {
            // Beaucoup de caractères non-alphanum → image probablement floue
            blurStreak++;
            noTextStreak = 0;
            tooCloseStreak = 0;
            if (blurStreak >= 2) {
              emitHint('blur');
              blurStreak = 0;
            }
          } else if (longestToken >= 18) {
            // Token très long et continu → texte zoomé, lot probablement coupé
            tooCloseStreak++;
            noTextStreak = 0;
            blurStreak = 0;
            if (tooCloseStreak >= 2) {
              emitHint('tooClose');
              tooCloseStreak = 0;
            }
          } else {
            noTextStreak = 0;
            blurStreak = 0;
            tooCloseStreak = 0;
          }
        }
      } catch (error) {
        // Snapshots peuvent échouer ponctuellement (caméra occupée etc.) — on ignore
      } finally {
        previewOcrBusyRef.current = false;
        if (snapshotUri) {
          try {
            await FileSystem.deleteAsync(snapshotUri, { idempotent: true });
          } catch {
            /* noop */
          }
        }
      }
    };

    intervalId = setInterval(tick, previewOcrIntervalMs);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [previewOcrEnabled, cameraReady, isProcessing, previewOcrIntervalMs, isFocused]);

  // Détection de luminosité ambiante (Android : LightSensor)
  const onLowLightRef = useRef(onLowLight);
  onLowLightRef.current = onLowLight;
  const lastLowLightStateRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!lowLightDetectionEnabled) return;

    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const available = await LightSensor.isAvailableAsync();
        if (!available || cancelled) return;
        LightSensor.setUpdateInterval(1000);
        subscription = LightSensor.addListener((data) => {
          const lux = typeof data?.illuminance === 'number' ? data.illuminance : null;
          if (lux === null) return;
          const isLow = lux < lowLightThresholdLux;
          if (lastLowLightStateRef.current !== isLow) {
            lastLowLightStateRef.current = isLow;
            onLowLightRef.current?.(isLow);
          }
        });
      } catch (error) {
        // LightSensor non dispo (iOS, ou pas de capteur)
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      lastLowLightStateRef.current = null;
    };
  }, [lowLightDetectionEnabled, lowLightThresholdLux]);

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
    // Après un refus, iOS/Android ne re-montrent plus la pop-up système
    // (canAskAgain === false). Dans ce cas, requestPermission() ne fait rien :
    // il faut rediriger l'utilisateur vers les Réglages de l'app.
    const blocked = !permission.canAskAgain;
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color={colors.accent} style={{ marginBottom: 16 }} />
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>
          {blocked ? t('scanner.cameraPermissionBlocked') : t('scanner.cameraPermissionNeeded')}
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.accent }]}
          onPress={() => (blocked ? Linking.openSettings() : requestPermission())}
        >
          <Text style={[styles.permissionButtonText, { color: colors.surface }]}>
            {blocked ? t('scanner.openSettings') : t('scanner.allowCamera')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showCapture = (mode === 'photo' || mode === 'band') && !hideCaptureButton;

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <CameraView
          // Mode CODE-BARRES seulement : on remonte une caméra fraîche à chaque
          // (re)focus (resetToken incrémenté au focus) → la détection repart et on
          // évite le freeze de reprise iOS. En mode LOT : PAS de key → la caméra
          // n'est jamais remontée (sinon freeze sur "Recommencer").
          key={enableBarcodeScanning ? `bc-${resetToken}` : undefined}
          ref={cameraRef}
          active={isFocused}
          style={styles.camera}
          facing="back"
          // PAS de prop `mode`/`autofocus` : les défauts d'expo-camera font déjà un
          // autofocus continu net (prouvé par l'écran code-barres). Forcer
          // autofocus="on" verrouillait/dégradait le focus sur l'écran lot.
          flash={flashOn && isFocused ? 'on' : 'off'}
          enableTorch={flashOn && isFocused}
          onCameraReady={() => setCameraReady(true)}
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
            style={[styles.backButtonTop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
        )}

        {/* Flash button */}
        {enableFlashToggle && (
          <TouchableOpacity
            style={flashPosition === 'top-right' ? styles.flashButtonTopRight : styles.flashButtonTop}
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
