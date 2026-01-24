import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  ScrollView,
  Easing,
} from 'react-native';
import { RecallRecord } from '../types';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';

interface ImmediateRecallAlertProps {
  visible: boolean;
  recall: RecallRecord | null;
  matchedLot: string;
  onClose: () => void;
}

/**
 * Alerte immédiate de rappel avec gyrophare clignotant
 * Affichée quand un rappel est détecté lors d'un scan
 */
export function ImmediateRecallAlert({
  visible,
  recall,
  matchedLot,
  onClose,
}: ImmediateRecallAlertProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  // Animation pour le gyrophare
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Animation de rotation du gyrophare
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      // Animation de clignotement
      const blinkAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

      rotateAnimation.start();
      blinkAnimation.start();

      return () => {
        rotateAnimation.stop();
        blinkAnimation.stop();
      };
    }
  }, [visible, rotateAnim, opacityAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!recall) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: '#d32f2f' }]}>
        {/* Gyrophare animé */}
        <Animated.View
          style={[
            styles.gyrophare,
            {
              opacity: opacityAnim,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <View style={styles.gyrophareLight} />
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          {/* Titre d'alerte */}
          <Text style={styles.alertTitle}>⚠️ {t('recallAlert.title')}</Text>
          <Text style={styles.alertSubtitle}>{t('recallAlert.doNotConsume')}</Text>

          {/* Numéro de lot détecté */}
          <View style={styles.lotContainer}>
            <Text style={styles.lotLabel}>Numéro de lot détecté :</Text>
            <Text style={styles.lotNumber}>{matchedLot}</Text>
          </View>

          {/* Informations du rappel */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Informations du rappel</Text>

            {recall.title && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Produit :</Text>
                <Text style={styles.infoValue}>{recall.title}</Text>
              </View>
            )}

            {recall.brand && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Marque :</Text>
                <Text style={styles.infoValue}>{recall.brand}</Text>
              </View>
            )}

            {recall.description && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('recallAlert.reasonLabel')}</Text>
                <Text style={styles.infoValue}>{recall.description}</Text>
              </View>
            )}
          </View>

          {/* Consignes en cas d'ingestion */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>
              🚨 {t('recallAlert.emergencyTitle')}
            </Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instruction}>
                • {t('recallAlert.doNotConsume')}
              </Text>
              <Text style={styles.instruction}>
                • {t('recallAlert.returnForRefund')}
              </Text>
              <Text style={styles.instruction}>
                • {t('recallAlert.emergencyText')}
              </Text>
            </View>
          </View>

          {/* Bouton de fermeture */}
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>J'AI COMPRIS</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 140,
  },
  gyrophare: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    width: 100,
    height: 100,
    zIndex: 10,
  },
  gyrophareLight: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 10,
  },
  alertTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  alertSubtitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  lotContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  lotLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 4,
  },
  lotNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#b71c1c',
  },
  infoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d32f2f',
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  instructionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  instructionsList: {
    gap: 12,
  },
  instruction: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 40,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#d32f2f',
  },
});
