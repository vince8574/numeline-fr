import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/themeContext';
import { GradientBackground } from '../src/components/GradientBackground';
import { useDietaryProfile } from '../src/hooks/useDietaryProfile';
import {
  ALLERGEN_KEYS,
  AVOID_FOOD_KEYS,
  NUTRIENT_KEYS,
  DEFAULT_THRESHOLDS
} from '../src/services/dietaryProfile';
import {
  ALLERGEN_LABELS,
  FOOD_LABELS,
  NUTRIENT_LABELS
} from '../src/services/dietaryLabels';

export default function DietaryProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useDietaryProfile();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const Row = ({
    label,
    value,
    onToggle,
    hint
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
    hint?: string;
  }) => (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.border }]}
      activeOpacity={0.7}
      onPress={onToggle}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.rowHint, { color: colors.textSecondary }]}>{hint}</Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onToggle} />
    </TouchableOpacity>
  );

  const SectionTitle = ({ children }: { children: string }) => (
    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{children}</Text>
  );

  return (
    <GradientBackground>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Mon régime</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Indiquez vos allergènes et les aliments à éviter. À chaque scan, l'app vous
          alertera si un produit vous concerne.
        </Text>

        {/* 1) Allergènes */}
        <SectionTitle>Allergènes</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ALLERGEN_KEYS.map((k) => (
            <Row
              key={k}
              label={ALLERGEN_LABELS[k]}
              value={profile.allergens.includes(k)}
              onToggle={() => profile.toggleAllergen(k)}
            />
          ))}
        </View>

        {/* 2) Aliments à éviter */}
        <SectionTitle>Aliments à éviter</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {AVOID_FOOD_KEYS.map((k) => (
            <Row
              key={k}
              label={FOOD_LABELS[k] ?? k}
              hint={k === 'gelatin' ? "Origine souvent non précisée — signalé « à vérifier »" : undefined}
              value={profile.avoidFoods.includes(k)}
              onToggle={() => profile.toggleAvoidFood(k)}
            />
          ))}
        </View>

        {/* 3) Régime */}
        <SectionTitle>Régime</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row
            label="Végétarien"
            value={profile.vegetarian}
            onToggle={() => profile.setVegetarian(!profile.vegetarian)}
          />
          <Row
            label="Végan"
            value={profile.vegan}
            onToggle={() => profile.setVegan(!profile.vegan)}
          />
        </View>

        {/* 4) Avancé — seuils nutritionnels (replié par défaut) */}
        <TouchableOpacity
          style={styles.advancedHeader}
          activeOpacity={0.7}
          onPress={() => setAdvancedOpen((o) => !o)}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 0 }]}>
            Avancé — seuils nutritionnels
          </Text>
          <Ionicons
            name={advancedOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <Text style={[styles.rowHint, { color: colors.textSecondary, marginBottom: 8 }]}>
          Pour régimes / diabète : soyez alerté si un produit dépasse votre seuil (pour 100 g).
        </Text>

        {advancedOpen ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {NUTRIENT_KEYS.map((k) => {
              const t = profile.thresholds[k];
              const enabled = !!t?.enabled;
              const val = t?.maxPer100g ?? DEFAULT_THRESHOLDS[k];
              return (
                <View key={k} style={[styles.row, { borderColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                      {NUTRIENT_LABELS[k]}
                    </Text>
                    {enabled ? (
                      <View style={styles.thresholdInputRow}>
                        <Text style={[styles.rowHint, { color: colors.textSecondary }]}>
                          Alerte si &gt;
                        </Text>
                        <TextInput
                          style={[
                            styles.thresholdInput,
                            { color: colors.textPrimary, borderColor: colors.border }
                          ]}
                          keyboardType="numeric"
                          defaultValue={String(val)}
                          onEndEditing={(e) => {
                            const n = parseFloat(e.nativeEvent.text.replace(',', '.'));
                            profile.setThreshold(k, {
                              enabled: true,
                              maxPer100g: Number.isFinite(n) ? n : DEFAULT_THRESHOLDS[k]
                            });
                          }}
                        />
                        <Text style={[styles.rowHint, { color: colors.textSecondary }]}>g/100 g</Text>
                      </View>
                    ) : null}
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(on) =>
                      profile.setThreshold(k, on ? { enabled: true, maxPer100g: val } : undefined)
                    }
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
          Basé sur les données Open Food Facts (déclaratives, collaboratives). Ne remplace pas
          la lecture de l'étiquette. Information parfois indisponible pour certains produits.
        </Text>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 12, marginTop: 2 },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24
  },
  thresholdInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  thresholdInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
    fontSize: 15,
    textAlign: 'center'
  },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 24, fontStyle: 'italic' }
});
