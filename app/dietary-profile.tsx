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
import { useI18n } from '../src/i18n/I18nContext';
import { GradientBackground } from '../src/components/GradientBackground';
import { useDietaryProfile } from '../src/hooks/useDietaryProfile';
import {
  ALLERGEN_KEYS,
  AVOID_FOOD_KEYS,
  NUTRIENT_KEYS,
  DEFAULT_THRESHOLDS
} from '../src/services/dietaryProfile';

export default function DietaryProfileScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const profile = useDietaryProfile();
  const [advancedOpen, setAdvancedOpen] = useState(true);

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

  // Titre de section : pastille sombre + barre ambre. Le fond du dégradé passe du
  // vert clair (haut) au sombre (bas) ; une pastille garantit un contraste fort
  // partout (le texte blanc seul se « lavait » en haut de l'écran).
  const SectionTitle = ({ children }: { children: string }) => (
    <View style={[styles.sectionTitleWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.sectionBar, { backgroundColor: colors.warning }]} />
      <Text style={[styles.sectionTitleText, { color: colors.textPrimary }]}>{children}</Text>
    </View>
  );

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
        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('dietary.intro')}</Text>

        {/* 1) Allergènes */}
        <SectionTitle>{t('dietary.sectionAllergens')}</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ALLERGEN_KEYS.map((k) => (
            <Row
              key={k}
              label={t(`dietary.allergens.${k}`)}
              value={profile.allergens.includes(k)}
              onToggle={() => profile.toggleAllergen(k)}
            />
          ))}
        </View>

        {/* 2) Aliments à éviter */}
        <SectionTitle>{t('dietary.sectionAvoidFoods')}</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {AVOID_FOOD_KEYS.map((k) => (
            <Row
              key={k}
              label={t(`dietary.foods.${k}`)}
              hint={k === 'gelatin' ? t('dietary.gelatinHint') : undefined}
              value={profile.avoidFoods.includes(k)}
              onToggle={() => profile.toggleAvoidFood(k)}
            />
          ))}
        </View>

        {/* 3) Régime */}
        <SectionTitle>{t('dietary.sectionDiet')}</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row
            label={t('dietary.vegetarian')}
            value={profile.vegetarian}
            onToggle={() => profile.setVegetarian(!profile.vegetarian)}
          />
          <Row
            label={t('dietary.vegan')}
            value={profile.vegan}
            onToggle={() => profile.setVegan(!profile.vegan)}
          />
        </View>

        {/* 4) Avancé — seuils nutritionnels */}
        <TouchableOpacity
          style={styles.advancedHeader}
          activeOpacity={0.7}
          onPress={() => setAdvancedOpen((o) => !o)}
        >
          <View style={[styles.sectionTitleWrap, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 0, marginBottom: 0 }]}>
            <View style={[styles.sectionBar, { backgroundColor: colors.warning }]} />
            <Text style={[styles.sectionTitleText, { color: colors.textPrimary }]}>
              {t('dietary.sectionAdvanced')}
            </Text>
            <Ionicons
              name={advancedOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
              style={{ marginLeft: 6 }}
            />
          </View>
        </TouchableOpacity>
        <Text style={[styles.rowHint, { color: colors.textSecondary, marginBottom: 8 }]}>
          {t('dietary.advancedHint')}
        </Text>

        {advancedOpen ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {NUTRIENT_KEYS.map((k) => {
              const th = profile.thresholds[k];
              const enabled = !!th?.enabled;
              const val = th?.maxPer100g ?? DEFAULT_THRESHOLDS[k];
              return (
                <View key={k} style={[styles.row, { borderColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                      {t(`dietary.nutrients.${k}`)}
                    </Text>
                    {enabled ? (
                      <View style={styles.thresholdInputRow}>
                        <Text style={[styles.rowHint, { color: colors.textSecondary }]}>
                          {t('dietary.alertIfAbove')}
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
                        <Text style={[styles.rowHint, { color: colors.textSecondary }]}>
                          {t('dietary.gramsPer100g')}
                        </Text>
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
          {t('dietary.disclaimer')}
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
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 22,
    marginBottom: 10
  },
  sectionBar: { width: 4, height: 18, borderRadius: 2 },
  sectionTitleText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
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
