import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { purchasePlan, purchaseScanPack, restorePurchases } from '../services/iapService';
import { PLAN_IDS, SCAN_PACKS } from '../constants/subscriptionPlans';
import { useIapPriceStore } from '../stores/useIapPriceStore';

type BillingPeriod = 'monthly' | 'yearly';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  scansUsed: number;
  scanLimit: number;
}

export function PaywallModal({ visible, onClose, scansUsed, scanLimit }: PaywallModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const prices = useIapPriceStore((s) => s.prices);
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  const progress = Math.min(scansUsed / scanLimit, 1);
  const isYearly = billing === 'yearly';

  const individualId = isYearly ? PLAN_IDS.INDIVIDUAL_YEARLY : PLAN_IDS.INDIVIDUAL;
  const enterpriseId = isYearly ? PLAN_IDS.ENTERPRISE_YEARLY : PLAN_IDS.ENTERPRISE;

  // Prix LOCALISÉ réel du store (devise du pays) + suffixe de période.
  // Repli sur la chaîne i18n tant que les prix du store ne sont pas chargés.
  const periodSuffix = isYearly ? t('subscription.perYear') : t('subscription.perMonth');
  const individualPrice = prices[individualId]
    ? `${prices[individualId]}${periodSuffix}`
    : isYearly ? t('subscription.individualPriceYearly') : t('subscription.individualPrice');
  const enterprisePrice = prices[enterpriseId]
    ? `${prices[enterpriseId]}${periodSuffix}`
    : isYearly ? t('subscription.enterprisePriceYearly') : t('subscription.enterprisePrice');

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    try {
      await purchasePlan(planId);
    } catch (error) {
      console.warn('[PaywallModal] Purchase failed:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleBuyPack = async (packId: string) => {
    setLoading(packId);
    try {
      await purchaseScanPack(packId);
    } catch (error) {
      console.warn('[PaywallModal] Pack purchase failed:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleRestore = async () => {
    setLoading('restore');
    try {
      await restorePurchases();
    } catch (error) {
      console.warn('[PaywallModal] Restore failed:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { backgroundColor: colors.accent }]}>
            <Text style={styles.headerIcon}>🔒</Text>
            <Text style={[styles.headerTitle, { color: colors.surface }]}>
              {t('subscription.limitReached')}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <Text style={[styles.scansText, { color: colors.textSecondary }]}>
              {t('subscription.scansUsed', { used: scansUsed, limit: scanLimit })}
            </Text>

            <View style={[styles.progressBar, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.danger },
                ]}
              />
            </View>

            <Text style={[styles.choosePlan, { color: colors.textPrimary }]}>
              {t('subscription.choosePlan')}
            </Text>

            {/* Toggle mensuel / annuel */}
            <View style={[styles.billingToggle, { backgroundColor: colors.surfaceAlt }]}>
              <TouchableOpacity
                style={[styles.billingOption, billing === 'monthly' && { backgroundColor: colors.accent }]}
                onPress={() => setBilling('monthly')}
              >
                <Text style={[styles.billingOptionText, { color: billing === 'monthly' ? colors.surface : colors.textSecondary }]}>
                  {t('subscription.billingMonthly')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.billingOption, billing === 'yearly' && { backgroundColor: colors.accent }]}
                onPress={() => setBilling('yearly')}
              >
                <Text style={[styles.billingOptionText, { color: billing === 'yearly' ? colors.surface : colors.textSecondary }]}>
                  {t('subscription.billingYearly')}
                </Text>
                {billing !== 'yearly' && (
                  <View style={[styles.yearlyBadge, { backgroundColor: colors.warning }]}>
                    <Text style={styles.yearlyBadgeText}>{t('subscription.yearlyBadge')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Plan Individuel */}
            <View style={[styles.planCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { color: colors.textPrimary }]}>
                  {t('subscription.individualTitle')}
                </Text>
                <View style={styles.priceBlock}>
                  <Text style={[styles.planPrice, { color: colors.accent }]}>{individualPrice}</Text>
                  {isYearly && (
                    <Text style={[styles.savingText, { color: colors.success }]}>
                      {t('subscription.individualSaving')}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.planBenefits}>
                <Text style={[styles.planBenefit, { color: colors.textPrimary }]}>
                  {'✓ '}{t('subscription.individualBenefit1')}
                </Text>
                <Text style={[styles.planBenefit, { color: colors.textPrimary }]}>
                  {'✓ '}{t('subscription.individualBenefit2')}
                </Text>
                <Text style={[styles.planBenefit, { color: colors.textPrimary }]}>
                  {'✓ '}{t('subscription.individualBenefit3')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.planButton, { backgroundColor: colors.accent }]}
                onPress={() => handleSubscribe(individualId)}
                disabled={loading !== null}
              >
                {loading === individualId ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={[styles.planButtonText, { color: colors.surface }]}>
                    {t('subscription.subscribe')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Plan Entreprise */}
            <View style={[styles.planCard, styles.enterpriseCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.accent }]}>
              <View style={[styles.enterpriseBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.enterpriseBadgeText, { color: colors.surface }]}>PRO</Text>
              </View>
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { color: colors.textPrimary }]}>
                  {t('subscription.enterpriseTitle')}
                </Text>
                <View style={styles.priceBlock}>
                  <Text style={[styles.planPrice, { color: colors.accent }]}>{enterprisePrice}</Text>
                  {isYearly && (
                    <Text style={[styles.savingText, { color: colors.success }]}>
                      {t('subscription.enterpriseSaving')}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.planBenefits}>
                <Text style={[styles.planBenefit, { color: colors.textPrimary }]}>
                  {'✓ '}{t('subscription.enterpriseBenefit1')}
                </Text>
                <Text style={[styles.planBenefit, { color: colors.textPrimary }]}>
                  {'✓ '}{t('subscription.enterpriseBenefit2')}
                </Text>
                <Text style={[styles.planBenefit, { color: colors.textPrimary }]}>
                  {'✓ '}{t('subscription.enterpriseBenefit3')}
                </Text>
                <Text style={[styles.planBenefit, { color: colors.textPrimary }]}>
                  {'✓ '}{t('subscription.enterpriseBenefit4')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.planButton, { backgroundColor: colors.accent }]}
                onPress={() => handleSubscribe(enterpriseId)}
                disabled={loading !== null}
              >
                {loading === enterpriseId ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={[styles.planButtonText, { color: colors.surface }]}>
                    {t('subscription.subscribe')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Séparateur packs */}
            <View style={[styles.packsSeparator, { borderColor: colors.border }]} />
            <Text style={[styles.packsTitle, { color: colors.textPrimary }]}>
              {t('subscription.packs.title')}
            </Text>
            <Text style={[styles.packsSubtitle, { color: colors.textSecondary }]}>
              {t('subscription.packs.subtitle')}
            </Text>

            {SCAN_PACKS.map((pack) => {
              const packPrice = prices[pack.id] ?? pack.price;
              return (
                <View key={pack.id} style={[styles.packRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.packLabel, { color: colors.textPrimary }]}>
                    {t('subscription.packs.scansLabel', { count: pack.quantity })}
                  </Text>
                  <Text style={[styles.packPrice, { color: colors.textPrimary }]}>{packPrice}</Text>
                  <TouchableOpacity
                    style={[styles.packButton, { backgroundColor: colors.accentSoft }]}
                    onPress={() => handleBuyPack(pack.id)}
                    disabled={loading !== null}
                  >
                    {loading === pack.id ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={[styles.packButtonText, { color: colors.accent }]}>
                        {t('subscription.packs.buy')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={loading !== null}
            >
              {loading === 'restore' ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.restoreButtonText, { color: colors.accent }]}>
                  {t('subscription.restorePurchases')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Mentions abonnement — conformité Apple 3.1.2 / Google Play */}
            <Text style={[styles.disclosure, { color: colors.textSecondary }]}>
              {t('subscription.renewalDisclosure')}
            </Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/legal/terms'); }}>
                <Text style={[styles.legalLink, { color: colors.accent }]}>{t('legal.terms')}</Text>
              </TouchableOpacity>
              <Text style={[styles.legalSep, { color: colors.textSecondary }]}>{'  ·  '}</Text>
              <TouchableOpacity onPress={() => { onClose(); router.push('/legal/privacy-policy'); }}>
                <Text style={[styles.legalLink, { color: colors.accent }]}>{t('legal.privacyPolicy')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.laterButton} onPress={onClose}>
              <Text style={[styles.laterButtonText, { color: colors.textSecondary }]}>
                {t('subscription.later')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    fontSize: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  scrollBody: {
    padding: 20,
    gap: 14,
  },
  scansText: {
    fontSize: 14,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  choosePlan: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  billingToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  billingOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  billingOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  yearlyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  yearlyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A2D2B',
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  enterpriseCard: {
    borderWidth: 2,
    position: 'relative',
  },
  enterpriseBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  enterpriseBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 17,
    fontWeight: '800',
  },
  savingText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  planBenefits: {
    gap: 6,
  },
  planBenefit: {
    fontSize: 14,
    lineHeight: 20,
  },
  planButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  packsSeparator: {
    borderTopWidth: 1,
    marginTop: 4,
  },
  packsTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  packsSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -8,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  packLabel: {
    fontSize: 14,
    flex: 1,
  },
  packPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 10,
  },
  packButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  packButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disclosure: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontSize: 12,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  laterButtonText: {
    fontSize: 14,
  },
});
