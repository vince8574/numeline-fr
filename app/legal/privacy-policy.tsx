import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/themeContext';
import { useI18n } from '../../src/i18n/I18nContext';
import { Ionicons } from '@expo/vector-icons';
import { getLegalDocuments } from '../../src/constants/legalDocuments';
import { GradientBackground } from '../../src/components/GradientBackground';
import { SimpleMarkdown } from '../../src/components/SimpleMarkdown';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { PRIVACY_POLICY } = getLegalDocuments(locale);

  return (
    <GradientBackground>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="arrow-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('legal.privacyPolicy')}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SimpleMarkdown source={PRIVACY_POLICY} />
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    padding: 16,
    paddingBottom: 40
  },
  card: {
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  }
});
