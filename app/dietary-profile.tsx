import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/themeContext';
import { useI18n } from '../src/i18n/I18nContext';
import { GradientBackground } from '../src/components/GradientBackground';
import { useDietaryProfile } from '../src/hooks/useDietaryProfile';
import type { DietaryPerson } from '../src/services/dietaryProfile';

// Écran « Mon régime » : LISTE des personnes (famille). Chaque personne a un
// prénom et son régime ; on en ajoute autant qu'on veut. Le détail (allergènes,
// aliments, seuils) se configure sur l'écran dédié à la personne (dietary-person).

export default function DietaryProfileScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const profile = useDietaryProfile();

  const summary = (p: DietaryPerson): string => {
    const parts: string[] = [];
    if (p.allergens.length) parts.push(t('dietary.summaryAllergens', { count: p.allergens.length }));
    if (p.avoidFoods.length) parts.push(t('dietary.summaryFoods', { count: p.avoidFoods.length }));
    if (p.vegetarian) parts.push(t('dietary.vegetarian'));
    if (p.vegan) parts.push(t('dietary.vegan'));
    const nb = Object.values(p.thresholds).filter((x) => x?.enabled).length;
    if (nb) parts.push(t('dietary.summaryThresholds', { count: nb }));
    return parts.join(' · ') || t('dietary.summaryEmpty');
  };

  const onAdd = () => {
    const id = profile.addPerson('');
    router.push(`/dietary-person?id=${id}` as any);
  };

  const onDelete = (p: DietaryPerson) => {
    const name = p.name || t('dietary.defaultPersonName');
    Alert.alert(
      t('dietary.deletePerson'),
      t('dietary.deletePersonConfirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('dietary.deletePerson'), style: 'destructive', onPress: () => profile.removePerson(p.id) }
      ]
    );
  };

  return (
    <GradientBackground>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('dietary.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('dietary.familyIntro')}</Text>

        {profile.people.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push(`/dietary-person?id=${p.id}` as any)}
          >
            <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="person" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {p.name || t('dietary.defaultPersonName')}
              </Text>
              <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={1}>
                {summary(p)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onDelete(p)} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {profile.people.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('dietary.noPeople')}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.warning }]}
          activeOpacity={0.7}
          onPress={onAdd}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.warning} />
          <Text style={[styles.addBtnText, { color: colors.textPrimary }]}>{t('dietary.addPerson')}</Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>{t('dietary.disclaimer')}</Text>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  backBtn: { padding: 4, width: 24 },
  title: { fontSize: 20, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  summary: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, textAlign: 'center', marginVertical: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4
  },
  addBtnText: { fontSize: 15, fontWeight: '700' },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 24, fontStyle: 'italic' }
});
