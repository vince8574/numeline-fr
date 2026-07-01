import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/themeContext';
import type { DietaryCheckResult, DietaryWarning } from '../services/dietaryCheckService';
import { allergenLabel, foodLabel, nutrientLabel, DIET_LABELS } from '../services/dietaryLabels';

// Bandeau d'alerte du profil alimentaire, affiché à la confirmation d'un scan.
// Hiérarchie d'affichage : allergène/aliment (danger) > traces/régime > nutrition
// (warn). Le RAPPEL produit reste prioritaire et géré ailleurs (il nécessite le
// lot) ; ce bandeau couvre le niveau allergène/aliment/nutrition à partir des
// données Open Food Facts (coût IA nul).

function warningText(w: DietaryWarning): string {
  switch (w.type) {
    case 'allergen':
      return `Allergène : ${allergenLabel(w.key)}`;
    case 'trace':
      return `Peut contenir : ${allergenLabel(w.key)}`;
    case 'avoidFood':
      return `Contient : ${foodLabel(w.key)}${w.key === 'gelatin' ? ' (origine à vérifier)' : ''}`;
    case 'diet':
      return `Non ${DIET_LABELS[w.key]?.toLowerCase() ?? w.key}`;
    case 'nutrient':
      return `${nutrientLabel(w.key)} élevé : ${w.value} g/100 g (seuil ${w.threshold})`;
    default:
      return w.key;
  }
}

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
  if (!result) return null;

  const { status, warnings, dataMissing } = result;

  // Rien à signaler et données présentes : bandeau vert rassurant (uniquement si
  // l'utilisateur a réellement configuré des critères → status 'ok').
  if (status === 'ok') {
    return (
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.success }]}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          Aucun allergène ni aliment à éviter détecté dans votre profil.
        </Text>
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
        {sorted.map((w, i) => (
          <Text key={`${w.type}-${w.key}-${i}`} style={[styles.text, { color: colors.textPrimary }]}>
            {warningText(w)}
          </Text>
        ))}
        {dataMissing ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Information incomplète pour ce produit — vérifiez l'étiquette.
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
  hint: { fontSize: 11, marginTop: 4, fontStyle: 'italic' }
});
