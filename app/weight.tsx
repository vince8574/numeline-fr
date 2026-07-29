import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/themeContext';
import { useI18n } from '../src/i18n/I18nContext';
import { GradientBackground } from '../src/components/GradientBackground';
import { PaywallModal } from '../src/components/PaywallModal';
import { useWeightStore } from '../src/stores/useWeightStore';
import { useWeightAccess } from '../src/hooks/useWeightAccess';
import {
  ACTIVITY_LEVELS,
  PACE_OPTIONS,
  MEALS,
  bmi,
  calorieTarget,
  estimatedTargetDate,
  goalFromWeights,
  movingAverage,
  kcalFromNutriments,
  todayISO,
  type ActivityLevel,
  type BodyProfile,
  type Meal
} from '../src/services/weightService';

// Écran « Objectif poids » (module de suivi de poids, 100 % calcul local, sans
// IA). Deux états : ONBOARDING (aucun profil corporel) puis TABLEAU DE BORD.
// L'onboarding + l'objectif calculé sont gratuits (aperçu qui donne envie) ; le
// journal et la courbe sont premium, avec un essai gratuit de 7 j qui démarre au
// premier usage pour créer l'habitude puis pousser l'abonnement.

const num = (s: string): number => {
  const v = parseFloat(s.replace(',', '.'));
  return isFinite(v) ? v : 0;
};

export default function WeightScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const body = useWeightStore((s) => s.body);
  const hasProfile = body != null;

  return (
    <GradientBackground>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('weight.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      {hasProfile ? <Dashboard /> : <Onboarding />}
    </GradientBackground>
  );
}

// ---------------------------------------------------------------------------
// ONBOARDING
// ---------------------------------------------------------------------------

function Onboarding() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const setBody = useWeightStore((s) => s.setBody);
  const addWeight = useWeightStore((s) => s.addWeight);

  const [sex, setSex] = useState<'male' | 'female'>('female');
  const [birthYear, setBirthYear] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [startWeight, setStartWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('sedentary');
  const [pace, setPace] = useState<number>(0.5);

  const draft: BodyProfile | null = useMemo(() => {
    const by = num(birthYear);
    const h = num(heightCm);
    const sw = num(startWeight);
    const tw = num(targetWeight);
    if (!by || !h || !sw || !tw) return null;
    return {
      sex,
      birthYear: by,
      heightCm: h,
      startWeightKg: sw,
      targetWeightKg: tw,
      activity,
      goal: goalFromWeights(sw, tw),
      paceKgPerWeek: pace,
      createdAt: Date.now()
    };
  }, [sex, birthYear, heightCm, startWeight, targetWeight, activity, pace]);

  const preview = draft ? calorieTarget(draft, draft.startWeightKg) : null;
  const targetDate = draft
    ? estimatedTargetDate(draft.startWeightKg, draft.targetWeightKg, draft.paceKgPerWeek)
    : null;

  const save = () => {
    if (!draft) return;
    setBody(draft);
    addWeight(draft.startWeightKg); // 1re pesée = poids de départ
  };

  const cs = fieldStyles(colors);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('weight.onboardIntro')}</Text>

      {/* Sexe */}
      <Text style={cs.label}>{t('weight.sex')}</Text>
      <View style={styles.chipRow}>
        <Chip label={t('weight.female')} active={sex === 'female'} onPress={() => setSex('female')} />
        <Chip label={t('weight.male')} active={sex === 'male'} onPress={() => setSex('male')} />
      </View>

      <NumberField
        label={t('weight.birthYear')}
        value={birthYear}
        onChange={setBirthYear}
        placeholder="1990"
      />
      <NumberField
        label={t('weight.height')}
        value={heightCm}
        onChange={setHeightCm}
        placeholder="170"
      />
      <NumberField
        label={t('weight.currentWeight')}
        value={startWeight}
        onChange={setStartWeight}
        placeholder="70"
      />
      <NumberField
        label={t('weight.targetWeight')}
        value={targetWeight}
        onChange={setTargetWeight}
        placeholder="65"
      />

      {/* Activité */}
      <Text style={cs.label}>{t('weight.activity')}</Text>
      <View style={styles.chipWrap}>
        {ACTIVITY_LEVELS.map((a) => (
          <Chip
            key={a}
            label={t(`weight.activity_${a}`)}
            active={activity === a}
            onPress={() => setActivity(a)}
          />
        ))}
      </View>

      {/* Rythme */}
      <Text style={cs.label}>{t('weight.pace')}</Text>
      <View style={styles.chipRow}>
        {PACE_OPTIONS.map((p) => (
          <Chip
            key={p}
            label={t('weight.pacePerWeek', { kg: p })}
            active={pace === p}
            onPress={() => setPace(p)}
          />
        ))}
      </View>

      {/* Aperçu objectif */}
      {preview && draft && (
        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <Text style={[styles.previewKcal, { color: colors.accent }]}>
            {preview.calorieTarget} {t('weight.kcalPerDay')}
          </Text>
          <Text style={[styles.previewSub, { color: colors.textSecondary }]}>
            {t('weight.previewTdee', { tdee: preview.tdee })}
          </Text>
          {targetDate && (
            <Text style={[styles.previewSub, { color: colors.textSecondary }]}>
              {t('weight.previewDate', { date: targetDate })}
            </Text>
          )}
          {preview.warnings.map((w) => (
            <Text key={w} style={[styles.warnText, { color: colors.warning }]}>
              ⚠ {t(w)}
            </Text>
          ))}
        </View>
      )}

      <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>{t('weight.disclaimer')}</Text>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: draft ? colors.accent : colors.border }]}
        disabled={!draft}
        onPress={save}
      >
        <Text style={[styles.ctaText, { color: colors.onAccent }]}>{t('weight.startGoal')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

function Dashboard() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const access = useWeightAccess();

  const body = useWeightStore((s) => s.body)!;
  const weights = useWeightStore((s) => s.weights);
  const removeFood = useWeightStore((s) => s.removeFood);
  const currentWeightKg = useWeightStore((s) => s.currentWeightKg);
  const totalsForDate = useWeightStore((s) => s.totalsForDate);
  const foodsForDate = useWeightStore((s) => s.foodsForDate);

  const [addMeal, setAddMeal] = useState<Meal | null>(null);
  const [weighVisible, setWeighVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const current = currentWeightKg() ?? body.startWeightKg;
  const target = calorieTarget(body, current);
  const totals = totalsForDate();
  const todays = foodsForDate();
  const remaining = target.calorieTarget - totals.kcal;
  const pct = Math.min(1, totals.kcal / Math.max(1, target.calorieTarget));

  // Exige l'accès (abonné ou essai). Démarre l'essai au 1er usage, sinon paywall.
  const ensureAccess = (): boolean => {
    if (access.canLog) return true;
    if (access.trialNotStarted) {
      access.startTrial();
      return true;
    }
    setPaywallVisible(true);
    return false;
  };

  const openAdd = (meal: Meal) => {
    if (!ensureAccess()) return;
    setAddMeal(meal);
  };
  const openWeigh = () => {
    if (!ensureAccess()) return;
    setWeighVisible(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Bandeau essai / paywall (moteur de conversion) */}
      {!access.isSubscribed && access.isTrial && (
        <TrialBanner
          text={t('weight.trialDaysLeft', { days: access.trialDaysLeft })}
          cta={t('weight.subscribe')}
          onPress={() => setPaywallVisible(true)}
          tone="accent"
        />
      )}
      {!access.isSubscribed && access.trialNotStarted && (
        <TrialBanner
          text={t('weight.trialOffer')}
          cta={t('weight.tryFree')}
          onPress={access.startTrial}
          tone="accent"
        />
      )}
      {!access.isSubscribed && access.trialExpired && (
        <TrialBanner
          text={t('weight.trialOver')}
          cta={t('weight.subscribe')}
          onPress={() => setPaywallVisible(true)}
          tone="warning"
        />
      )}

      {/* Objectif du jour (toujours visible = aperçu gratuit) */}
      <View style={[styles.ringCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.ringRemaining, { color: remaining >= 0 ? colors.accent : colors.danger }]}>
          {Math.abs(remaining)}
        </Text>
        <Text style={[styles.ringLabel, { color: colors.textSecondary }]}>
          {remaining >= 0 ? t('weight.kcalLeft') : t('weight.kcalOver')}
        </Text>
        <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.barFill,
              {
                width: `${pct * 100}%`,
                backgroundColor: remaining >= 0 ? colors.accent : colors.danger
              }
            ]}
          />
        </View>
        <Text style={[styles.ringSub, { color: colors.textSecondary }]}>
          {t('weight.consumedOfTarget', { consumed: totals.kcal, target: target.calorieTarget })}
        </Text>
        <View style={styles.macroRow}>
          <Macro label={t('weight.protein')} value={totals.protein_g} colors={colors} />
          <Macro label={t('weight.carbs')} value={totals.carbs_g} colors={colors} />
          <Macro label={t('weight.fat')} value={totals.fat_g} colors={colors} />
        </View>
      </View>

      {/* Journal par repas */}
      {MEALS.map((meal) => {
        const items = todays.filter((f) => f.meal === meal);
        return (
          <View key={meal} style={styles.mealBlock}>
            <View style={styles.mealHead}>
              <Text style={[styles.mealTitle, { color: colors.textPrimary }]}>
                {t(`weight.meal_${meal}`)}
              </Text>
              <TouchableOpacity onPress={() => openAdd(meal)} hitSlop={8} style={styles.addBtn}>
                <Ionicons name="add-circle" size={26} color={colors.accent} />
              </TouchableOpacity>
            </View>
            {items.length === 0 ? (
              <Text style={[styles.emptyMeal, { color: colors.textSecondary }]}>
                {t('weight.mealEmpty')}
              </Text>
            ) : (
              items.map((f) => (
                <View key={f.id} style={[styles.foodRow, { backgroundColor: colors.surface }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.foodName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text style={[styles.foodMeta, { color: colors.textSecondary }]}>
                      {f.quantityG} g · {f.kcal} {t('weight.kcal')}
                      {f.nutriscore ? `  ·  Nutri-Score ${f.nutriscore.toUpperCase()}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFood(f.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        );
      })}

      {/* Courbe de poids */}
      <View style={[styles.weightCard, { backgroundColor: colors.surface }]}>
        <View style={styles.mealHead}>
          <Text style={[styles.mealTitle, { color: colors.textPrimary }]}>{t('weight.progress')}</Text>
          <TouchableOpacity onPress={openWeigh} hitSlop={8} style={styles.addBtn}>
            <Ionicons name="add-circle" size={26} color={colors.accent} />
          </TouchableOpacity>
        </View>
        <View style={styles.weightStats}>
          <Stat label={t('weight.current')} value={`${current} kg`} colors={colors} />
          <Stat label={t('weight.goal')} value={`${body.targetWeightKg} kg`} colors={colors} />
          <Stat label={t('weight.bmi')} value={bmi(current, body.heightCm).toFixed(1)} colors={colors} />
        </View>
        <Sparkline weights={weights.map((w) => w.weightKg)} target={body.targetWeightKg} colors={colors} />
      </View>

      <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>{t('weight.disclaimer')}</Text>

      {addMeal && <AddFoodModal meal={addMeal} onClose={() => setAddMeal(null)} />}
      {weighVisible && <WeighInModal onClose={() => setWeighVisible(false)} />}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// MODALES
// ---------------------------------------------------------------------------

function AddFoodModal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const addFood = useWeightStore((s) => s.addFood);

  const [name, setName] = useState('');
  const [grams, setGrams] = useState('100');
  const [kcal100, setKcal100] = useState('');

  const qty = num(grams);
  const kcal = kcalFromNutriments({ 'energy-kcal_100g': num(kcal100) }, qty);
  const canSave = name.trim().length > 0 && qty > 0 && kcal != null;

  const save = () => {
    if (!canSave || kcal == null) return;
    addFood({ date: todayISO(), meal, name: name.trim(), quantityG: qty, kcal });
    onClose();
  };

  const cs = fieldStyles(colors);
  return (
    <ModalShell title={t(`weight.meal_${meal}`)} onClose={onClose}>
      <View style={cs.inputWrap}>
        <Text style={cs.label}>{t('weight.foodName')}</Text>
        <TextInput
          style={cs.input}
          value={name}
          onChangeText={setName}
          placeholder={t('weight.foodNamePlaceholder')}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <Text style={cs.label}>{t('weight.quantity')}</Text>
      <View style={styles.chipRow}>
        {[30, 50, 100, 150].map((g) => (
          <Chip key={g} label={`${g} g`} active={qty === g} onPress={() => setGrams(String(g))} />
        ))}
      </View>
      <NumberField label={t('weight.gramsCustom')} value={grams} onChange={setGrams} placeholder="100" />
      <NumberField label={t('weight.kcalPer100')} value={kcal100} onChange={setKcal100} placeholder="250" />

      {kcal != null && (
        <Text style={[styles.previewKcal, { color: colors.accent, fontSize: 22, marginTop: 4 }]}>
          {kcal} {t('weight.kcal')}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: canSave ? colors.accent : colors.border }]}
        disabled={!canSave}
        onPress={save}
      >
        <Text style={[styles.ctaText, { color: colors.onAccent }]}>{t('weight.add')}</Text>
      </TouchableOpacity>
    </ModalShell>
  );
}

function WeighInModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const addWeight = useWeightStore((s) => s.addWeight);
  const [kg, setKg] = useState('');
  const v = num(kg);
  const canSave = v > 0;

  const save = () => {
    if (!canSave) return;
    addWeight(v);
    onClose();
  };

  return (
    <ModalShell title={t('weight.weighIn')} onClose={onClose}>
      <NumberField label={t('weight.weightKg')} value={kg} onChange={setKg} placeholder="70" />
      <TouchableOpacity
        style={[styles.cta, { backgroundColor: canSave ? colors.accent : colors.border }]}
        disabled={!canSave}
        onPress={save}
      >
        <Text style={[styles.ctaText, { color: colors.onAccent }]}>{t('weight.save')}</Text>
      </TouchableOpacity>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// PETITS COMPOSANTS
// ---------------------------------------------------------------------------

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.accent : colors.surface,
          borderColor: active ? colors.accent : colors.border
        }
      ]}
    >
      <Text style={{ color: active ? colors.onAccent : colors.textPrimary, fontWeight: '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const cs = fieldStyles(colors);
  return (
    <View style={cs.inputWrap}>
      <Text style={cs.label}>{label}</Text>
      <TextInput
        style={cs.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
      />
    </View>
  );
}

function Macro({ label, value, colors }: { label: string; value: number; colors: any }) {
  return (
    <View style={styles.macroItem}>
      <Text style={[styles.macroValue, { color: colors.textPrimary }]}>{value} g</Text>
      <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.macroItem}>
      <Text style={[styles.macroValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function TrialBanner({
  text,
  cta,
  onPress,
  tone
}: {
  text: string;
  cta: string;
  onPress: () => void;
  tone: 'accent' | 'warning';
}) {
  const { colors } = useTheme();
  const bg = tone === 'warning' ? colors.warning : colors.accentSoft;
  const fg = tone === 'warning' ? colors.onAccent : colors.textPrimary;
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: colors.accent }]}>
      <Text style={[styles.bannerText, { color: fg }]}>{text}</Text>
      <TouchableOpacity style={[styles.bannerCta, { backgroundColor: colors.accent }]} onPress={onPress}>
        <Text style={{ color: colors.onAccent, fontWeight: '700' }}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Sparkline sans dépendance : barres verticales mappées entre min et max de la
// série, avec la tendance (moyenne mobile) en teinte accent.
function Sparkline({
  weights,
  target,
  colors
}: {
  weights: number[];
  target: number;
  colors: any;
}) {
  const { t } = useI18n();
  if (weights.length < 2) {
    return <Text style={[styles.emptyMeal, { color: colors.textSecondary }]}>{t('weight.needMoreWeights')}</Text>;
  }
  const recent = weights.slice(-14);
  const trend = movingAverage(recent, 7);
  const all = [...recent, target];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(0.1, max - min);
  const H = 90;
  return (
    <View style={[styles.spark, { height: H }]}>
      {recent.map((_, i) => {
        const h = 8 + ((trend[i] - min) / span) * (H - 12);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 1,
              height: h,
              borderRadius: 3,
              backgroundColor: colors.accent
            }}
          />
        );
      })}
    </View>
  );
}

function ModalShell({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderColor: colors.border }]}>
            <View style={{ width: 24 }} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

const fieldStyles = (colors: any) =>
  StyleSheet.create({
    inputWrap: { marginTop: 12 },
    label: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 6, color: colors.textPrimary },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textPrimary
    }
  });

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 16, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chipWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },

  previewCard: { marginTop: 20, borderRadius: 16, borderWidth: 1.5, padding: 18, alignItems: 'center' },
  previewKcal: { fontSize: 30, fontWeight: '900' },
  previewSub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  warnText: { fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: '600' },

  cta: { marginTop: 24, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800' },

  banner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  bannerCta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },

  ringCard: { borderRadius: 20, padding: 20, alignItems: 'center' },
  ringRemaining: { fontSize: 46, fontWeight: '900' },
  ringLabel: { fontSize: 13, marginTop: -2 },
  barTrack: { height: 10, borderRadius: 6, width: '100%', marginTop: 14, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 6 },
  ringSub: { fontSize: 13, marginTop: 8 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 14 },
  macroItem: { alignItems: 'center' },
  macroValue: { fontSize: 16, fontWeight: '800' },
  macroLabel: { fontSize: 12, marginTop: 2 },

  mealBlock: { marginTop: 20 },
  mealHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealTitle: { fontSize: 16, fontWeight: '800' },
  addBtn: { padding: 2 },
  emptyMeal: { fontSize: 13, marginTop: 6 },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 10
  },
  foodName: { fontSize: 15, fontWeight: '700' },
  foodMeta: { fontSize: 12, marginTop: 2 },

  weightCard: { borderRadius: 20, padding: 18, marginTop: 24 },
  weightStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, marginBottom: 12 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { maxHeight: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20 }
});
