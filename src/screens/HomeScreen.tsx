import { useCallback, useMemo, useRef, useEffect } from 'react';
import { Alert, BackHandler, FlatList, StyleSheet, Switch, Text, View, Image, Animated, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { GradientBackground } from '../components/GradientBackground';
import { usePreferencesStore } from '../stores/usePreferencesStore';

function StatCard({
  value,
  label,
  icon,
  color,
  onPress,
  delay,
  colors,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
  delay: number;
  colors: any;
}) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.statCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start()}
        onPressOut={() =>
          Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start()
        }
        style={[styles.statCardInner, { backgroundColor: colors.surface }]}
      >
        <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function HomeScreen() {
  const { colors, accessible } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { products } = useScannedProducts();
  const accessibilityMode = usePreferencesStore((s) => s.accessibilityMode);
  const setAccessibilityMode = usePreferencesStore((s) => s.setAccessibilityMode);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const disclaimerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(titleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(disclaimerAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  // Confirmation avant de quitter l'app via le bouton back hardware Android.
  // Actif uniquement quand l'écran d'accueil a le focus (sinon le back navigue
  // normalement entre les écrans).
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          t('common.exitTitle'),
          t('common.exitMessage'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => null },
            { text: t('common.exitConfirm'), style: 'destructive', onPress: () => BackHandler.exitApp() }
          ],
          { cancelable: true }
        );
        return true; // empêche la sortie immédiate
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [t])
  );

  const stats = useMemo(() => {
    const total = products.length;
    const recalled = products.filter((product) => product.recallStatus === 'recalled').length;
    const pending = products.filter((product) => product.recallStatus === 'unknown').length;
    return { total, recalled, pending };
  }, [products]);

  return (
    <GradientBackground>
      <FlatList
        data={[] as { id: string }[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Logo */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  opacity: logoAnim,
                  transform: [
                    {
                      scale: logoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.logoGlow} />
              <Image
                source={require('../../assets/logo_numelineFR.png')}
                style={styles.logoBig}
                resizeMode="cover"
              />
            </Animated.View>

            {/* Title */}
            <Animated.View
              style={{
                opacity: titleAnim,
                transform: [
                  {
                    translateY: titleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [15, 0],
                    }),
                  },
                ],
              }}
            >
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('home.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('home.subtitle')}
              </Text>
            </Animated.View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <StatCard
                value={stats.total}
                label={t('home.stats.scanned')}
                icon="scan-outline"
                color="#35F2A9"
                onPress={() => router.push('/history')}
                delay={300}
                colors={colors}
              />
              <StatCard
                value={stats.recalled}
                label={t('home.stats.recalled')}
                icon="alert-circle-outline"
                color="#FF647C"
                onPress={() => router.push({ pathname: '/history', params: { filter: 'recalled' } })}
                delay={450}
                colors={colors}
              />
              <StatCard
                value={stats.pending}
                label={t('home.stats.pending')}
                icon="time-outline"
                color="#FFC857"
                onPress={() => router.push({ pathname: '/history', params: { filter: 'unknown' } })}
                delay={600}
                colors={colors}
              />
            </View>

            {/* Accessibility toggle (mode malvoyant) */}
            <Animated.View
              style={{
                opacity: disclaimerAnim,
                marginBottom: 12,
              }}
            >
              <View
                style={[
                  styles.accessibilityCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: accessible ? colors.accent : colors.border,
                    borderWidth: accessible ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.accessibilityIconWrap}>
                  <Ionicons
                    name="eye-outline"
                    size={accessible ? 28 : 22}
                    color={accessible ? colors.accent : colors.textSecondary}
                  />
                </View>
                <View style={styles.accessibilityTextWrap}>
                  <Text style={[styles.accessibilityTitle, { color: colors.textPrimary }]}>
                    {t('home.accessibilityToggle.title')}
                  </Text>
                  <Text style={[styles.accessibilityHint, { color: colors.textSecondary }]}>
                    {t('home.accessibilityToggle.hint')}
                  </Text>
                </View>
                <Switch
                  value={accessibilityMode}
                  onValueChange={setAccessibilityMode}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={accessibilityMode ? colors.surface : colors.surfaceAlt}
                  accessibilityLabel={t('home.accessibilityToggle.title')}
                />
              </View>
            </Animated.View>

            {/* Disclaimer (tappable -> About screen for government source disclosure) */}
            <Animated.View
              style={{
                opacity: disclaimerAnim,
              }}
            >
              <Pressable
                onPress={() => router.push('/legal/about' as any)}
                accessibilityRole="link"
                accessibilityLabel={t('common.learnMore')}
                style={({ pressed }) => [
                  styles.disclaimerCard,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: 'rgba(255,255,255,0.06)',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                <View style={styles.disclaimerTextWrap}>
                  <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                    {t('common.appDisclaimer')}
                  </Text>
                  <Text style={[styles.disclaimerLink, { color: colors.accent }]}>
                    {t('common.learnMore')} →
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
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
  list: {
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  logoGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(53, 242, 169, 0.08)',
    top: -20,
  },
  logoBig: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 42,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 28,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
  },
  statCardInner: {
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'Lora_700Bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  disclaimerTextWrap: {
    flex: 1,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  disclaimerLink: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  accessibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  accessibilityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(53, 242, 169, 0.12)',
  },
  accessibilityTextWrap: {
    flex: 1,
  },
  accessibilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  accessibilityHint: {
    fontSize: 12,
    lineHeight: 16,
  },
});
