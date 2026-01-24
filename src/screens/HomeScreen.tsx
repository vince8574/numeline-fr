import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { GradientBackground } from '../components/GradientBackground';

export function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { products } = useScannedProducts();

  const stats = useMemo(() => {
    const total = products.length;
    const recalled = products.filter((product) => product.recallStatus === 'recalled').length;
    const pending = products.filter((product) => product.recallStatus === 'unknown').length;

    return { total, recalled, pending };
  }, [products]);

  return (
    <GradientBackground>
      <FlatList
        data={[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* Logo centré en grand */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logo_numelineFR.png')}
                style={styles.logoBig}
                resizeMode="contain"
              />
            </View>

            {/* Titre centré */}
            <Text
              style={[styles.title, { color: colors.textPrimary }]}
            >
              {t('home.title')}
            </Text>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('home.subtitle')}
            </Text>

            <View style={styles.statsContainer}>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: colors.surface }]}
                onPress={() => router.push('/history')}
              >
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.stats.scanned')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: colors.surface }]}
                onPress={() => router.push({ pathname: '/history', params: { filter: 'recalled' } })}
              >
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.recalled}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.stats.recalled')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: colors.surface }]}
                onPress={() => router.push({ pathname: '/history', params: { filter: 'unknown' } })}
              >
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.pending}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home.stats.pending')}</Text>
              </TouchableOpacity>
            </View>

          </View>
        }
        renderItem={() => null}
        ListEmptyComponent={null}
        scrollEnabled={false}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  list: {
    padding: 24
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10
  },
  logoBig: {
    width: 140,
    height: 140,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 46,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 28,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 12
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    marginRight: 12,
    padding: 16
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800'
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 18
  },
  emptyContainer: {
    marginTop: 80,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22
  }
});
