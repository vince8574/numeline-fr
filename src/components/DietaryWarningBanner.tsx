import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import type { DietaryCheckResult, DietaryWarning } from '../services/dietaryCheckService';

// Bandeau d'alerte du profil alimentaire, affiché à la confirmation d'un scan.
// Hiérarchie d'affichage : allergène/aliment (danger) > traces/régime > nutrition
// (warn). Le RAPPEL produit reste prioritaire et géré ailleurs (il nécessite le
// lot) ; ce bandeau couvre le niveau allergène/aliment/nutrition à partir des
// données Open Food Facts (coût IA nul). Tous les libellés passent par i18n.

// Ordre d'affichage : d'abord les alertes fortes (allergène, aliment, régime),
// puis les avertissements (traces, nutrition).
const TYPE_ORDER: Record<DietaryWarning['type'], number> = {
  allergen: 0,
  avoidFood: 1,
  diet: 2,
  trace: 3,
  nutrient: 4
};

export function DietaryWarningBanner({ result }: { result: DietaryCheckResult | null }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (!result) return null;

  const { status, warnings, dataMissing } = result;

  // Qui est concerné (uniquement s'il y a plusieurs personnes) : « toute la
  // famille » si tout le monde, sinon la liste des prénoms.
  const personsLabel = (w: DietaryWarning): string | null => {
    if (!result.multiPerson) return null;
    if (w.everyone) return t('dietary.everyone');
    if (!w.persons || w.persons.length === 0) return null;
    return w.persons.join(', ');
  };

  const warningText = (w: DietaryWarning): string => {
    switch (w.type) {
      case 'allergen':
        return t('dietary.bannerAllergen', { name: t(`dietary.allergens.${w.key}`) });
      case 'trace':
        return t('dietary.bannerTrace', { name: t(`dietary.allergens.${w.key}`) });
      case 'avoidFood':
        return w.ambiguous
          ? t('dietary.bannerMayContain', { name: t(`dietary.foods.${w.key}`) })
          : t('dietary.bannerContains', { name: t(`dietary.foods.${w.key}`) });
      case 'diet':
        return w.key === 'vegan'
          ? t('dietary.bannerNonVegan')
          : t('dietary.bannerNonVegetarian');
      case 'nutrient':
        return t('dietary.bannerNutrientHigh', {
          name: t(`dietary.nutrients.${w.key}`),
          value: w.value,
          threshold: w.threshold
        });
      default:
        return w.key;
    }
  };

  // Rien à signaler et données présentes : bandeau vert rassurant (uniquement si
  // l'utilisateur a réellement configuré des critères → status 'ok').
  if (status === 'ok') {
    return (
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.success }]}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>{t('dietary.bannerOk')}</Text>
      </View>
    );
  }

  // Profil vide (rien à vérifier) et pas de données manquantes : pas de bandeau.
  if (warnings.length === 0 && !dataMissing) return null;

  const accent = status === 'danger' ? colors.danger : colors.warning;
  const icon = status === 'danger' ? 'alert-circle' : 'warning';
  const sorted = [...warnings].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);

  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: accent }]}>
      <Ionicons name={icon as any} size={20} color={accent} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {sorted.map((w, i) => {
          const who = personsLabel(w);
          return (
            <View key={`${w.type}-${w.key}-${i}`} style={i > 0 ? styles.warnRow : undefined}>
              <Text style={[styles.text, { color: colors.textPrimary }]}>{warningText(w)}</Text>
              {who ? (
                <Text style={[styles.who, { color: colors.textSecondary }]}>
                  {t('dietary.concerns', { persons: who })}
                </Text>
              ) : null}
            </View>
          );
        })}
        {dataMissing ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('dietary.bannerDataMissing')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    width: '100%'
  },
  text: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  who: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  warnRow: { marginTop: 6 },
  hint: { fontSize: 11, marginTop: 4, fontStyle: 'italic' }
});
