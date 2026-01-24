import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useTheme } from '../theme/themeContext';

type ScannerMode = 'barcode' | 'photo' | 'band';

type ScannerProps = {
  onCapture: (uri: string) => Promise<void> | void;
  onBarcodeScanned?: (barcode: string) => void;
  isProcessing?: boolean;
  enableBarcodeScanning?: boolean;
  mode?: ScannerMode; // 'barcode' pour scan code-barres, 'photo' ou 'band' pour capture photo
  resetToken?: number; // change pour forcer un remount de la caméra
  enableFlashToggle?: boolean;
  aiMessage?: string; // Message à afficher quand l'IA est utilisée
};

export function Scanner({
  onCapture,
  onBarcodeScanned,
  isProcessing = false,
  enableBarcodeScanning = false,
  mode = 'photo',
  resetToken,
  enableFlashToggle = true,
  aiMessage
}: ScannerProps) {
  const { colors } = useTheme();
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

      // Éviter les scans multiples du même code-barres
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

  // Forcer un reset (remontage) du composant caméra
  useEffect(() => {
    setScannedBarcode(null);
    setCameraReady(false);
    setFlashOn(false);
  }, [resetToken]);

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>
          Chargement des autorisations caméra...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>
          Nous avons besoin d'accéder à votre appareil photo pour scanner les emballages.
        </Text>
        <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.accent }]} onPress={requestPermission}>
          <Text style={[styles.permissionButtonText, { color: colors.surface }]}>Autoriser</Text>
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
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39']
                }
              : undefined
          }
          onBarcodeScanned={enableBarcodeScanning ? handleBarcodeScanned : undefined}
        />
        {/* Bouton Flash en haut à gauche */}
        {enableFlashToggle && (
          <TouchableOpacity
            style={styles.flashButtonTop}
            onPress={() => setFlashOn((prev) => !prev)}
            disabled={!cameraReady}
          >
            <View style={[styles.flashIconContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Text style={[styles.flashIcon, { color: flashOn ? '#FFD700' : colors.surface }]}>
                ⚡
              </Text>
              {flashOn && <View style={styles.flashActiveDot} />}
            </View>
          </TouchableOpacity>
        )}

        <View pointerEvents="none" style={styles.overlay}>
          {mode === 'barcode' ? (
            // Cible carrée pour le scan de code-barres
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
                  <Text style={[styles.aiMessageText, { color: colors.surface }]}>
                    🤖 {aiMessage}
                  </Text>
                </View>
              )}
            </>
          ) : (
            // Cadre classique pour la capture photo
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
              <Text style={styles.cameraIcon}>📸</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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
  flashIcon: {
    fontSize: 24
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
  cameraIcon: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1
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
    marginBottom: 16
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  aiMessageContainer: {
    position: 'absolute',
    bottom: -60,
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
  }
});
