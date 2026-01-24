import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import type { ScannedProduct } from '../types';

interface RecallAlertModalProps {
  visible: boolean;
  onClose: () => void;
  products: ScannedProduct[];
}

export function RecallAlertModal({ visible, onClose, products }: RecallAlertModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const handleViewProduct = (productId: string) => {
    onClose();
    router.push(`/details?productId=${productId}`);
  };

  if (products.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { backgroundColor: colors.danger }]}>
            <Text style={styles.headerIcon}>🚨</Text>
            <Text style={[styles.headerTitle, { color: colors.surface }]}>
              ALERTE RAPPEL
            </Text>
          </View>

          <ScrollView style={styles.scrollContent}>
            <Text style={[styles.warningText, { color: colors.textPrimary }]}>
              {products.length === 1
                ? 'Un produit que vous avez scanné fait maintenant l\'objet d\'un rappel :'
                : `${products.length} produits que vous avez scannés font maintenant l'objet d'un rappel :`}
            </Text>

            {products.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[styles.productCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.danger }]}
                onPress={() => handleViewProduct(product.id)}
              >
                <View style={styles.productHeader}>
                  <Text style={[styles.productBrand, { color: colors.textPrimary }]}>
                    {product.brand}
                  </Text>
                  <View style={[styles.dangerBadge, { backgroundColor: colors.danger }]}>
                    <Text style={[styles.dangerBadgeText, { color: colors.surface }]}>
                      RAPPELÉ
                    </Text>
                  </View>
                </View>
                <Text style={[styles.productLot, { color: colors.textSecondary }]}>
                  Lot {product.lotNumber}
                </Text>
                <Text style={[styles.viewDetailsText, { color: colors.accent }]}>
                  Toucher pour voir les détails →
                </Text>
              </TouchableOpacity>
            ))}

            <View style={[styles.importantNotice, { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderColor: colors.danger }]}>
              <Text style={[styles.importantTitle, { color: colors.danger }]}>
                ⚠️ IMPORTANT
              </Text>
              <Text style={[styles.importantText, { color: colors.textPrimary }]}>
                • Ne consommez pas ces produits{'\n'}
                • Rapportez-les au magasin pour remboursement{'\n'}
                • En cas de symptômes, contactez les urgences (15 ou 112)
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.accent }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: colors.surface }]}>
              J'ai compris
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
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12
  },
  header: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8
  },
  headerIcon: {
    fontSize: 48
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  scrollContent: {
    padding: 20
  },
  warningText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center'
  },
  productCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  productBrand: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12
  },
  dangerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  dangerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  productLot: {
    fontSize: 15,
    marginBottom: 8
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4
  },
  importantNotice: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginTop: 8,
    marginBottom: 8
  },
  importantTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  importantText: {
    fontSize: 14,
    lineHeight: 22
  },
  closeButton: {
    margin: 20,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center'
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '700'
  }
});
