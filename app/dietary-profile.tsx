import { useEffect, useState } from 'react';
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
import { useSubscription } from '../src/hooks/useSubscription';
import { HealthConsentModal } from '../src/components/HealthConsentModal';
import type { DietaryPerson } from '../src/services/dietaryProfile';

// Écran « Mon régime » : LISTE des personnes (famille). Chaque personne a un
// prénom et son régime ; on en ajoute autant qu'on veut. Le détail (allergènes,
// aliments, seuils) se configure sur l'écran dédié à la personne (dietary-person).
//
// FREEMIUM : le nombre de personnes est illimité, mais sans abonnement une SEULE
// est « active » (= celle dont le résultat s'affiche au scan). On la choisit ici.
// Les abonnés voient tous les profils au scan → pas de sélection nécessaire.

export default function DietaryProfileScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const profile = useDietaryProfile();
  const { isPremium } = useSubscription();
  // Consentement données de santé (art. 9). Requis avant toute saisie. On ouvre
  // la modale au 1er ajout tant qu'il n'est pas donné.
  const [consentVisible, setConsentVisible] = useState(false);
  // Distingue les 2 usages de la modale : confirmation d'un ajout (→ créer un
  // profil après acceptation) vs simple confirmation pour un utilisateur migré.
  const [consentThenAdd, setConsentThenAdd] = useState(false);
  const hasHealthConsent = profile.healthConsentAt != null;

  // Utilisateurs MIGRÉS : profils déjà saisis avant l'existence du consentement.
  // On leur demande de le confirmer une fois à l'ouverture de l'écran.
  useEffect(() => {
    if (!hasHealthConsent && profile.people.length > 0) {
      setConsentThenAdd(false);
      setConsentVisible(true);
    }
  }, [hasHealthConsent, profile.people.length]);

  const summary = (p: DietaryPerson): string => {
    const parts: string[] = [];
    if (p.allergens.length) parts.push(t('dietary.summaryAllergens', { count: p.allergens.length }));
    if (p.avoidFoods.length) parts.push(t('dietary.summaryFoods', { count: p.avoidFoods.length }));
    if (p.vegetarian) parts.push(t('dietary.vegetarian'));
    if (p.vegan) parts.push(t('dietary.vegan'));
    if (p.pregnant) parts.push(t('dietary.pregnant'));
    const nb = Object.values(p.thresholds).filter((x) => x?.enabled).length;
    if (nb) parts.push(t('dietary.summaryThresholds', { count: nb }));
    return parts.join(' · ') || t('dietary.summaryEmpty');
  };

  const createAndOpen = () => {
    const id = profile.addPerson('');
    router.push(`/dietary-person?id=${id}` as any);
  };

  const onAdd = () => {
    // Consentement art. 9 requis avant la 1re saisie de données de santé.
    if (!hasHealthConsent) {
      setConsentThenAdd(true);
      setConsentVisible(true);
      return;
    }
    createAndOpen();
  };

  const onConsentAccept = () => {
    profile.grantHealthConsent();
    setConsentVisible(false);
    if (consentThenAdd) createAndOpen();
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
      <HealthConsentModal
        visible={consentVisible}
        onAccept={onConsentAccept}
        onDecline={() => setConsentVisible(false)}
      />
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('dietary.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('dietary.familyIntro')}</Text>

        <Text style={[styles.activeHint, { color: colors.textSecondary }]}>
          {isPremium ? t('dietary.allActivePremium') : t('dietary.activeHint')}
        </Text>

        {profile.people.map((p) => {
          const isActive = p.id === profile.activePersonId;
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: !isPremium && isActive ? colors.warning : colors.border
                }
              ]}
              activeOpacity={0.7}
              onPress={() => router.push(`/dietary-person?id=${p.id}` as any)}
            >
              {/* Sélecteur d'actif : inutile pour un abonné (tous les profils sont analysés). */}
              {!isPremium ? (
                <TouchableOpacity
                  onPress={() => profile.setActivePerson(p.id)}
                  hitSlop={10}
                  style={{ padding: 4 }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                >
                  <Ionicons
                    name={isActive ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isActive ? colors.warning : colors.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
              <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="person" size={20} color={colors.warning} />
              </View>
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                    {p.name || t('dietary.defaultPersonName')}
                  </Text>
                  {!isPremium && isActive ? (
                    <View style={[styles.activeBadge, { backgroundColor: colors.warning }]}>
                      <Text style={[styles.activeBadgeText, { color: colors.onAccent }]}>
                        {t('dietary.activePerson')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={1}>
                  {summary(p)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onDelete(p)} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}

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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  summary: { fontSize: 12, marginTop: 2 },
  activeHint: { fontSize: 12, lineHeight: 17, marginBottom: 12, fontStyle: 'italic' },
  activeBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
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
