import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';

// Barre de navigation reprenant les onglets, affichée sur les écrans hors du
// groupe (tabs) — typiquement l'écran résultat/détails — pour que le menu reste
// accessible "tout le temps" après une validation. Chaque entrée fait un
// router.replace vers l'onglet correspondant (le scan repart sur le code-barres).
const ITEMS = [
  { route: '/(tabs)/home', icon: require('../../assets/home.png'), labelKey: 'navigation.home' },
  { route: '/(tabs)/scan', icon: require('../../assets/scan.png'), labelKey: 'navigation.scan' },
  { route: '/(tabs)/history', icon: require('../../assets/history.png'), labelKey: 'navigation.history' },
  { route: '/(tabs)/language', icon: require('../../assets/language.png'), labelKey: 'settings.title' }
] as const;

export function ResultBottomNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, paddingBottom: 14 + insets.bottom }
      ]}
    >
      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.route}
          style={styles.item}
          accessibilityRole="button"
          accessibilityLabel={t(item.labelKey)}
          onPress={() => router.replace(item.route as any)}
        >
          <Image source={item.icon} style={styles.icon} resizeMode="contain" />
          <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
            {t(item.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  icon: {
    width: 34,
    height: 34,
    opacity: 0.8
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3
  }
});
