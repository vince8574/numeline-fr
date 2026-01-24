/**
 * Écran de test pour les notifications
 * Accessible via : /test-notifications
 *
 * UNIQUEMENT POUR DÉVELOPPEMENT
 * À supprimer avant la mise en production
 */

import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '../src/theme/themeContext';
import { scheduleRecallNotification } from '../src/services/notificationService';
import { TEST_RECALLS } from '../scripts/testNotification';
import { RecallAlert } from '../src/components/RecallAlert';
import { extractRecallReason } from '../src/utils/recallUtils';

export default function TestNotificationsScreen() {
  const { colors } = useTheme();
  const [selectedRecall, setSelectedRecall] = useState<number | null>(null);
  const [lastNotification, setLastNotification] = useState<string>('');

  const sendTestNotification = async (index: number) => {
    const recall = TEST_RECALLS[index];

    const testProduct = {
      id: `test-${index}`,
      brand: recall.brand || 'Test Brand',
      lotNumber: recall.lotNumbers[0],
      scannedAt: Date.now(),
      recallStatus: 'recalled' as const,
      recallReference: recall.id,
      lastCheckedAt: Date.now()
    };

    try {
      await scheduleRecallNotification(testProduct, recall);
      setLastNotification(`Notification envoyée : ${recall.title}`);
      Alert.alert(
        'Notification envoyée',
        'Vérifiez votre centre de notifications',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible d\'envoyer la notification',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            🧪 Test des notifications
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Écran de développement - Testez les notifications de rappel
          </Text>
        </View>

        {lastNotification ? (
          <View style={[styles.statusBox, { backgroundColor: colors.success }]}>
            <Text style={styles.statusText}>✅ {lastNotification}</Text>
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Types de rappels disponibles
          </Text>

          {TEST_RECALLS.map((recall, index) => {
            const reason = extractRecallReason(recall);
            return (
              <View key={recall.id} style={styles.recallItem}>
                <TouchableOpacity
                  style={[
                    styles.recallButton,
                    {
                      backgroundColor: selectedRecall === index ? colors.accent : colors.surfaceAlt
                    }
                  ]}
                  onPress={() => setSelectedRecall(index)}
                >
                  <Text
                    style={[
                      styles.recallTitle,
                      {
                        color: selectedRecall === index ? colors.background : colors.textPrimary
                      }
                    ]}
                  >
                    {recall.brand} - {reason || recall.title}
                  </Text>
                  <Text
                    style={[
                      styles.recallLot,
                      {
                        color: selectedRecall === index ? colors.background : colors.textSecondary
                      }
                    ]}
                  >
                    Lot: {recall.lotNumbers[0]}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: colors.danger }]}
                  onPress={() => sendTestNotification(index)}
                >
                  <Text style={styles.sendButtonText}>📱 Envoyer la notification</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {selectedRecall !== null && TEST_RECALLS[selectedRecall] && (
          <View style={styles.preview}>
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
              Aperçu de l'alerte
            </Text>
            <RecallAlert
              recall={TEST_RECALLS[selectedRecall]}
              reason={extractRecallReason(TEST_RECALLS[selectedRecall])}
            />
          </View>
        )}

        <View style={[styles.infoBox, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>ℹ️ Instructions</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            1. Sélectionnez un type de rappel ci-dessus{'\n'}
            2. Appuyez sur "Envoyer la notification"{'\n'}
            3. Vérifiez votre centre de notifications{'\n'}
            4. L'aperçu montre l'alerte affichée dans les détails{'\n\n'}
            ⚠️ Les notifications fonctionnent uniquement avec un build natif (pas Expo Go)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 24,
    gap: 24
  },
  header: {
    padding: 24,
    borderRadius: 24,
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22
  },
  statusBox: {
    padding: 16,
    borderRadius: 16
  },
  statusText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  section: {
    padding: 24,
    borderRadius: 24,
    gap: 16
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8
  },
  recallItem: {
    gap: 12
  },
  recallButton: {
    padding: 16,
    borderRadius: 16
  },
  recallTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  recallLot: {
    fontSize: 14,
    fontWeight: '500'
  },
  sendButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700'
  },
  preview: {
    gap: 16
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  infoBox: {
    padding: 20,
    borderRadius: 20,
    gap: 12
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  infoText: {
    fontSize: 15,
    lineHeight: 24
  }
});
