import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { fetchRecallsByCountry } from '../services/apiService';
import { BrandAutocomplete } from '../components/BrandAutocomplete';
import { incrementBrandUsage } from '../services/customBrandsService';
import { scheduleRecallNotification } from '../services/notificationService';
import { GradientBackground } from '../components/GradientBackground';

export function ManualEntryScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { addProduct, updateRecall } = useScannedProducts();
  const country = usePreferencesStore((state) => state.country);
  const [brand, setBrand] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!lotNumber.trim()) {
      Alert.alert(t('manualEntry.errors.lotRequired'), t('manualEntry.errors.lotRequiredMessage'));
      return;
    }

    try {
      setIsSubmitting(true);
      const finalBrand = brand.trim() || t('common.unknown');

      const product = await addProduct({
        brand: finalBrand,
        lotNumber: lotNumber.trim()
      });

      // Incrémenter le compteur d'utilisation si c'est une marque personnalisée
      if (brand.trim()) {
        await incrementBrandUsage(brand.trim());
      }

      const recalls = await fetchRecallsByCountry(country);
      const recallStatus = await updateRecall(product, recalls);

      // Send notification if product is recalled
      if (recallStatus.status === 'recalled') {
        const recall = recalls.find(r => r.id === recallStatus.recallReference);
        if (recall) {
          await scheduleRecallNotification(product, recall);
        }
      }

      router.replace({ pathname: '/details/[id]', params: { id: product.id } });
    } catch (error) {
      Alert.alert(
        t('manualEntry.errors.saveFailed'),
        error instanceof Error ? error.message : t('manualEntry.errors.checkFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GradientBackground>
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <View style={[styles.titleIconWrap, { backgroundColor: colors.accent }]}>
            <Ionicons name="create" size={24} color={colors.onAccent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('manualEntry.title')}</Text>
        </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('manualEntry.subtitle')}
      </Text>

      <View style={styles.fieldHeaderRow}>
        <View style={[styles.fieldIcon, { backgroundColor: 'rgba(53, 242, 169, 0.18)' }]}>
          <Ionicons name="pricetag" size={20} color={colors.accent} />
        </View>
        <Text style={[styles.fieldHeaderLabel, { color: colors.textPrimary }]}>{t('manualEntry.brandLabel')}</Text>
      </View>
      <BrandAutocomplete
        value={brand}
        onChangeText={setBrand}
        placeholder={t('manualEntry.brandPlaceholder')}
        autoCapitalize="words"
      />

      <View style={styles.fieldHeaderRow}>
        <View style={[styles.fieldIcon, { backgroundColor: 'rgba(53, 242, 169, 0.18)' }]}>
          <Ionicons name="barcode" size={20} color={colors.accent} />
        </View>
        <Text style={[styles.fieldHeaderLabel, { color: colors.textPrimary }]}>{t('manualEntry.lotLabel')}</Text>
      </View>
      <View style={[styles.field, { backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, letterSpacing: 1.2 }]}
          placeholder={t('manualEntry.lotPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={lotNumber}
          onChangeText={setLotNumber}
          autoCapitalize="characters"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.accent, opacity: isSubmitting ? 0.5 : 1 }]}
        onPress={handleSave}
        disabled={isSubmitting}
        accessibilityRole="button"
      >
        <Ionicons
          name={isSubmitting ? 'hourglass' : 'checkmark-circle'}
          size={22}
          color={colors.onAccent}
          style={{ marginRight: 10 }}
        />
        <Text style={[styles.buttonText, { color: colors.onAccent }]}>
          {isSubmitting ? t('manualEntry.verifying') : t('manualEntry.save')}
        </Text>
      </TouchableOpacity>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4
  },
  titleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 15,
    marginVertical: 12,
    lineHeight: 22
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 8
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  field: {
    borderRadius: 18,
    padding: 16
  },
  input: {
    fontSize: 18,
    fontWeight: '600'
  },
  button: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  }
});
