import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { useTheme } from '../../src/theme/themeContext';
import { useI18n } from '../../src/i18n/I18nContext';
import { Ionicons } from '@expo/vector-icons';

export default function LanguageScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#C4DECC' }]}>
      <View style={styles.titleContainer}>
        <Image
          source={require('../../assets/logo_numelineFR.png')}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('language.subtitle')}
      </Text>

      <View style={styles.selectorWrapper}>
        <LanguageSelector />
      </View>

      {/* Section Documents Légaux */}
      <View style={styles.legalSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('legal.sectionTitle')}
        </Text>

        <TouchableOpacity
          style={[styles.legalButton, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/legal/privacy-policy')}
        >
          <View style={styles.legalButtonContent}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.accent} />
            <Text style={[styles.legalButtonText, { color: colors.textPrimary }]}>
              {t('legal.privacyPolicy')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.legalButton, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/legal/terms')}
        >
          <View style={styles.legalButtonContent}>
            <Ionicons name="document-text-outline" size={24} color={colors.accent} />
            <Text style={[styles.legalButtonText, { color: colors.textPrimary }]}>
              {t('legal.terms')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.legalButton, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/legal/legal-notice')}
        >
          <View style={styles.legalButtonContent}>
            <Ionicons name="information-circle-outline" size={24} color={colors.accent} />
            <Text style={[styles.legalButtonText, { color: colors.textPrimary }]}>
              {t('legal.legalNotice')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden'
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20
  },
  selectorWrapper: {
    marginTop: 12
  },
  legalSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16
  },
  legalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  legalButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  legalButtonText: {
    fontSize: 16,
    fontWeight: '600'
  }
});
