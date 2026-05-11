import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/themeContext';
import { useI18n } from '../../src/i18n/I18nContext';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../src/components/GradientBackground';

const RAPPEL_CONSO_URL = 'https://rappel.conso.gouv.fr/';
const DGCCRF_URL = 'https://www.economie.gouv.fr/dgccrf';

export default function AboutScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('about.linkErrorTitle'), t('about.linkErrorMessage'));
      }
    } catch {
      Alert.alert(t('about.linkErrorTitle'), t('about.linkErrorMessage'));
    }
  };

  return (
    <GradientBackground>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('about.title')}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.warningCard, { backgroundColor: '#FFF4E5', borderColor: '#FF9800' }]}>
          <Ionicons name="warning-outline" size={22} color="#E65100" />
          <Text style={[styles.warningTitle, { color: '#E65100' }]}>
            {t('about.disclaimerTitle')}
          </Text>
        </View>

        <Text style={[styles.paragraph, { color: colors.textPrimary }]}>
          {t('about.disclaimerBody')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('about.sourceTitle')}
        </Text>
        <Text style={[styles.paragraph, { color: colors.textPrimary }]}>
          {t('about.sourceBody')}
        </Text>

        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onPress={() => openLink(RAPPEL_CONSO_URL)}
          accessibilityRole="link"
          accessibilityLabel={t('about.openRappelConso')}
        >
          <Ionicons name="open-outline" size={20} color={colors.accent} />
          <View style={styles.linkButtonTextWrap}>
            <Text style={[styles.linkButtonLabel, { color: colors.textPrimary }]}>
              {t('about.openRappelConso')}
            </Text>
            <Text style={[styles.linkButtonUrl, { color: colors.textSecondary }]}>
              {RAPPEL_CONSO_URL}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onPress={() => openLink(DGCCRF_URL)}
          accessibilityRole="link"
          accessibilityLabel={t('about.openDgccrf')}
        >
          <Ionicons name="open-outline" size={20} color={colors.accent} />
          <View style={styles.linkButtonTextWrap}>
            <Text style={[styles.linkButtonLabel, { color: colors.textPrimary }]}>
              {t('about.openDgccrf')}
            </Text>
            <Text style={[styles.linkButtonUrl, { color: colors.textSecondary }]}>
              {DGCCRF_URL}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('about.limitationTitle')}
        </Text>
        <Text style={[styles.paragraph, { color: colors.textPrimary }]}>
          {t('about.limitationBody')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('about.editorTitle')}
        </Text>
        <Text style={[styles.paragraph, { color: colors.textPrimary }]}>
          {t('about.editorBody')}
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  backButton: {
    padding: 8,
    marginRight: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 12
  },
  linkButtonTextWrap: {
    flex: 1
  },
  linkButtonLabel: {
    fontSize: 15,
    fontWeight: '600'
  },
  linkButtonUrl: {
    fontSize: 12,
    marginTop: 2
  }
});
