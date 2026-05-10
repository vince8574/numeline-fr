import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { useTheme } from '../../src/theme/themeContext';
import { useI18n } from '../../src/i18n/I18nContext';
import { usePreferencesStore } from '../../src/stores/usePreferencesStore';
import { GradientBackground } from '../../src/components/GradientBackground';
import { Ionicons } from '@expo/vector-icons';

export default function LanguageScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const accessibilityMode = usePreferencesStore((s) => s.accessibilityMode);
  const setAccessibilityMode = usePreferencesStore((s) => s.setAccessibilityMode);

  const handleToggleAccessibility = (value: boolean) => {
    setAccessibilityMode(value);
    if (value) {
      Speech.speak(t('accessibility.voiceTestMessage'), { language: 'fr-FR' });
    } else {
      Speech.stop();
    }
  };

  const handleTestVoice = () => {
    Speech.stop();
    Speech.speak(t('accessibility.voiceTestMessage'), { language: 'fr-FR' });
  };

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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

      {/* Section Accessibilité */}
      <View style={styles.accessibilitySection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('accessibility.title')}
        </Text>

        <View style={[styles.accessibilityCard, { backgroundColor: colors.surface }]}>
          <View style={styles.accessibilityRow}>
            <View style={styles.accessibilityIconWrap}>
              <Ionicons name="volume-high-outline" size={24} color={colors.accent} />
            </View>
            <View style={styles.accessibilityTextWrap}>
              <Text style={[styles.accessibilityLabel, { color: colors.textPrimary }]}>
                {t('accessibility.voiceGuide')}
              </Text>
              <Text style={[styles.accessibilityDescription, { color: colors.textSecondary }]}>
                {t('accessibility.voiceGuideDescription')}
              </Text>
            </View>
            <Switch
              value={accessibilityMode}
              onValueChange={handleToggleAccessibility}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={accessibilityMode ? colors.surface : '#f4f3f4'}
              accessibilityLabel={t('accessibility.voiceGuide')}
            />
          </View>

          {accessibilityMode && (
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
              onPress={handleTestVoice}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.voiceTest')}
            >
              <Ionicons name="play-circle-outline" size={20} color={colors.accent} />
              <Text style={[styles.testButtonText, { color: colors.accent }]}>
                {t('accessibility.voiceTest')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section Documents Légaux */}
      <View style={styles.legalSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('legal.sectionTitle')}
        </Text>

        <TouchableOpacity
          style={[styles.legalButton, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/legal/about' as any)}
          accessibilityRole="link"
          accessibilityLabel={t('legal.about')}
        >
          <View style={styles.legalButtonContent}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.accent} />
            <Text style={[styles.legalButtonText, { color: colors.textPrimary }]}>
              {t('legal.about')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

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
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  contentContainer: {
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
  accessibilitySection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)'
  },
  accessibilityCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  accessibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  accessibilityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(53, 242, 169, 0.12)'
  },
  accessibilityTextWrap: {
    flex: 1
  },
  accessibilityLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2
  },
  accessibilityDescription: {
    fontSize: 12,
    lineHeight: 16
  },
  testButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '700'
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
