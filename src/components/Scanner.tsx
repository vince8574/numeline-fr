import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { LightSensor } from 'expo-sensors';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';

type ScannerMode = 'barcode' | 'photo' | 'band';

type ScannerProps = {
  onCapture: (uri: string) => Promise<void> | void;
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
  onLowLight
}, ref) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback(
    (scanningResult: BarcodeScanningResult) => {
      if (!enableBarcodeScanning || isProcessing || !onBarcodeScanned) {
        return;
      }

      const barcode = scanningResult.data;

      if (barcode && barcode !== scannedBarcode) {
        console.log('[Scanner] Barcode scanned:', barcode);
        setScannedBarcode(barcode);
        onBarcodeScanned(barcode);
      }
    },
    [enableBarcodeScanning, isProcessing, onBarcodeScanned, scannedBarcode]
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isProcessing || !cameraReady) {
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
        skipProcessing: false
      });

      if (photo?.uri) {
        await onCapture(photo.uri);
      }
    } catch (error) {
      console.warn('Capture failed', error);
    }
  }, [cameraReady, isProcessing, onCapture]);

  useEffect(() => {
    setScannedBarcode(null);
    setCameraReady(false);
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

  // Preview OCR loop (snapshot léger -> MLKit -> callback texte)
  const previewOcrBusyRef = useRef(false);
  const onPreviewOcrTextRef = useRef(onPreviewOcrText);
  onPreviewOcrTextRef.current = onPreviewOcrText;

  useEffect(() => {
    if (!previewOcrEnabled || !cameraReady || isProcessing) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

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
  }, [previewOcrEnabled, cameraReady, isProcessing, previewOcrIntervalMs]);

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
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color={colors.accent} style={{ marginBottom: 16 }} />
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>
          {t('scanner.cameraPermissionNeeded')}
        </Text>
        <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.accent }]} onPress={requestPermission}>
          <Text style={[styles.permissionButtonText, { color: colors.surface }]}>{t('scanner.allowCamera')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showCapture = mode === 'photo' || mode === 'band';

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <CameraView
          key={resetToken}
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={flashOn ? 'on' : 'off'}
          enableTorch={flashOn}
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
