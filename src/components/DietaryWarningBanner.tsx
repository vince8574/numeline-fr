import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { useSubscription } from '../hooks/useSubscription';
import { useDietaryProfileStore } from '../stores/useDietaryProfileStore';
import type { DietaryCheckResult, DietaryWarning, PersonResult } from '../services/dietaryCheckService';

// Bandeau d'alerte du profil alimentaire, affiché à la confirmation d'un scan.
// Affichage PAR PERSONNE (style « Maman : ❌ … / Papa : ✅ Compatible ») pour que
// chacun voie clairement s'il peut consommer le produit. Détection basée sur les
// données Open Food Facts (coût IA nul). Le RAPPEL produit reste géré ailleurs
// (il nécessite le numéro de lot, scanné à l'étape suivante).
//
// FREEMIUM : sans abonnement, seule la personne ACTIVE voit son résultat ; les
// autres profils apparaissent verrouillés (« Visible avec un abonnement ») →
// appui = paywall. Les abonnés voient tous les profils.

const TYPE_ORDER: Record<DietaryWarning['type'], number> = {
  celiac: 0,
  allergen: 0,
  custom: 1,
  avoidFood: 1,
  pregnancy: 2,
  diet: 3,
  trace: 4,
  nutrient: 5
};

export function DietaryWarningBanner({
  result,
  onUpgrade
}: {
  result: DietaryCheckResult | null;
  onUpgrade?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isPremium } = useSubscription();
  const activePersonId = useDietaryProfileStore((s) => s.activePersonId);
  if (!result) return null;

  const { perPerson, dataMissing, status, warnings } = result;

  // Rien de configuré (aucun critère) → pas de bandeau.
  if (warnings.length === 0 && !dataMissing && status !== 'ok') return null;

  // Personne active (repli sur la 1re si l'id n'est plus valide).
  const active = perPerson.find((p) => p.id === activePersonId) ?? perPerson[0];
  const others = perPerson.filter((p) => p.id !== active?.id);

  const warningText = (w: DietaryWarning): string => {
    switch (w.type) {
      case 'allergen':
        return t('dietary.bannerAllergen', { name: t(`dietary.allergens.${w.key}`) });
      case 'celiac':
        return t('dietary.bannerAllergen', { name: t('dietary.allergens.gluten') });
      case 'custom':
        return t('dietary.bannerContains', { name: w.key });
      case 'trace':
        return t('dietary.bannerTrace', { name: t(`dietary.allergens.${w.key}`) });
      case 'avoidFood':
        return w.ambiguous
          ? t('dietary.bannerMayContain', { name: t(`dietary.foods.${w.key}`) })
          : t('dietary.bannerContains', { name: t(`dietary.foods.${w.key}`) });
      case 'pregnancy':
        return w.level === 'warn'
          ? t('dietary.bannerPregnancyLimit', { name: t(`dietary.pregnancyRisks.${w.key}`) })
          : t('dietary.bannerPregnancyAvoid', { name: t(`dietary.pregnancyRisks.${w.key}`) });
      case 'diet':
        return w.key === 'vegan' ? t('dietary.bannerNonVegan') : t('dietary.bannerNonVegetarian');
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

  const rowFor = (p: PersonResult) => {
    const meta =
      p.status === 'danger'
        ? { icon: 'close-circle' as const, color: colors.danger }
        : p.status === 'warn'
          ? { icon: 'alert-circle' as const, color: colors.warning }
          : p.status === 'unknown'
            ? { icon: 'help-circle' as const, color: colors.textSecondary }
            : { icon: 'checkmark-circle' as const, color: colors.success };

    const reasons =
      p.warnings.length > 0
        ? [...p.warnings].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]).map(warningText).join(' · ')
        : p.status === 'unknown'
          ? t('dietary.dataUncertain')
          : t('dietary.compatible');

    return (
      <View key={p.id} style={styles.personRow}>
        <Ionicons name={meta.icon} size={18} color={meta.color} style={{ marginTop: 1 }} />
        <Text style={[styles.personText, { color: colors.textPrimary }]}>
          <Text style={styles.personName}>{p.name || t('dietary.defaultPersonName')} : </Text>
          <Text style={{ color: meta.color }}>{reasons}</Text>
        </Text>
      </View>
    );
  };

  // Ligne verrouillée (profil non actif, utilisateur sans abonnement) : on
  // n'affiche QUE le prénom — jamais le statut, qui est justement le produit vendu.
  const lockedRowFor = (p: PersonResult) => (
    <TouchableOpacity
      key={p.id}
      style={styles.personRow}
      onPress={onUpgrade}
      disabled={!onUpgrade}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
      <Text style={[styles.personText, { color: colors.textPrimary }]}>
        <Text style={styles.personName}>{p.name || t('dietary.defaultPersonName')} : </Text>
        <Text style={[styles.locked, { color: colors.accent }]}>{t('dietary.lockedPremium')}</Text>
      </Text>
    </TouchableOpacity>
  );

  // Sans abonnement, l'accent suit le statut de la personne ACTIVE (et non le
  // statut agrégé, qui laisserait fuiter l'état des profils verrouillés).
  const accentStatus = isPremium ? status : (active?.status ?? status);
  const accent =
    accentStatus === 'danger'
      ? colors.danger
      : accentStatus === 'warn'
        ? colors.warning
        : accentStatus === 'ok'
          ? colors.success
          : colors.textSecondary;

  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: accent }]}>
      {isPremium ? (
        perPerson.map(rowFor)
      ) : (
        <>
          {active ? rowFor(active) : null}
          {others.map(lockedRowFor)}
        </>
      )}
      {dataMissing ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('dietary.bannerDataMissing')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    width: '100%'
  },
  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 3 },
  personText: { flex: 1, fontSize: 13, lineHeight: 18 },
  personName: { fontWeight: '800' },
  locked: { fontWeight: '700', textDecorationLine: 'underline' },
  hint: { fontSize: 11, marginTop: 6, fontStyle: 'italic' }
});
