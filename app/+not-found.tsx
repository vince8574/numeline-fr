import { Link } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../src/theme/themeContext';

export default function NotFound() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Page introuvable</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Cette page n'existe pas. Revenez à l'accueil pour continuer.
      </Text>
      <Link href="/(tabs)/home" style={[styles.link, { color: colors.accent }]}>
        Retour à l'accueil
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: '700'
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24
  },
  link: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '700'
  }
});
