import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { purchasePremium, restorePurchases } from '../services/iapService';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  scansUsed: number;
  scanLimit: number;
}

export function PaywallModal({ visible, onClose, scansUsed, scanLimit }: PaywallModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const progress = Math.min(scansUsed / scanLimit, 1);

  const handleSubscribe = async () => {
    try {
      await purchasePremium();
    } catch (error) {
      console.warn('[PaywallModal] Purchase failed:', error);
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
    } catch (error) {
      console.warn('[PaywallModal] Restore failed:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { backgroundColor: colors.accent }]}>
            <Text style={styles.headerIcon}>🔒</Text>
            <Text style={[styles.headerTitle, { color: colors.surface }]}>
              {t('subscription.limitReached')}
            </Text>
          </View>

          <View style={styles.body}>
            <Text style={[styles.scansText, { color: colors.textSecondary }]}>
              {t('subscription.scansUsed', { used: scansUsed, limit: scanLimit })}
            </Text>

            <View style={[styles.progressBar, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.danger },
                ]}
              />
            </View>

            <Text style={[styles.benefitsTitle, { color: colors.textPrimary }]}>
              {t('subscription.premiumTitle')}
            </Text>

            <View style={styles.benefitsList}>
              <Text style={[styles.benefitItem, { color: colors.textPrimary }]}>
                {t('subscription.benefit1')}
              </Text>
              <Text style={[styles.benefitItem, { color: colors.textPrimary }]}>
                {t('subscription.benefit2')}
              </Text>
              <Text style={[styles.benefitItem, { color: colors.textPrimary }]}>
                {t('subscription.benefit3')}
              </Text>
            </View>

            <Text style={[styles.price, { color: colors.accent }]}>
              {t('subscription.price')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={handleSubscribe}
          >
            <Text style={[styles.subscribeButtonText, { color: colors.surface }]}>
              {t('subscription.subscribe')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
          >
            <Text style={[styles.restoreButtonText, { color: colors.accent }]}>
              {t('subscription.restorePurchases')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterButton}
            onPress={onClose}
          >
            <Text style={[styles.laterButtonText, { color: colors.textSecondary }]}>
              {t('subscription.later')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 48,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  body: {
    padding: 24,
    gap: 16,
  },
  scansText: {
    fontSize: 15,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    fontSize: 15,
    lineHeight: 22,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  subscribeButton: {
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  restoreButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  laterButton: {
    marginTop: 4,
    marginBottom: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  laterButtonText: {
    fontSize: 15,
  },
});
