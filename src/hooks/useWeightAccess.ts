import { useSubscriptionStore } from '../stores/useSubscriptionStore';
import { useWeightStore } from '../stores/useWeightStore';

// Accès au module « Objectif poids » : abonné = accès complet ; sinon un ESSAI
// GRATUIT limité dans le temps donne l'accès complet, puis se ferme pour pousser
// la reconversion (paywall).
//
// Stratégie de conversion :
//  - L'ONBOARDING et l'objectif calculé restent TOUJOURS visibles (aperçu
//    gratuit qui donne envie — on montre la valeur avant de demander de payer).
//  - Le JOURNAL et la COURBE (l'usage quotidien qui crée l'habitude) sont
//    ouverts pendant l'essai, puis verrouillés → l'utilisateur a pris le pli et
//    est incité à s'abonner pour continuer.

export const WEIGHT_TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WeightAccess = {
  /** L'utilisateur peut-il journaliser / peser (fonctions premium) ? */
  canLog: boolean;
  /** Abonné payant (accès permanent). */
  isSubscribed: boolean;
  /** Essai gratuit en cours (accès temporaire). */
  isTrial: boolean;
  /** Essai déjà consommé et terminé, sans abonnement → paywall. */
  trialExpired: boolean;
  /** L'essai n'a jamais été démarré (aucun clic « Essayer »). */
  trialNotStarted: boolean;
  /** Jours entiers restants sur l'essai (0 si terminé / non lancé). */
  trialDaysLeft: number;
  /** Démarre l'essai (idempotent). */
  startTrial: () => void;
};

export function useWeightAccess(): WeightAccess {
  const isSubscribed = useSubscriptionStore((s) => s.isPremium);
  const trialStartedAt = useWeightStore((s) => s.trialStartedAt);
  const startTrial = useWeightStore((s) => s.startTrial);

  const now = Date.now();
  const trialElapsed = trialStartedAt ? now - trialStartedAt : 0;
  const trialMs = WEIGHT_TRIAL_DAYS * DAY_MS;
  const trialActive = trialStartedAt != null && trialElapsed < trialMs;
  const trialDaysLeft = trialActive ? Math.max(1, Math.ceil((trialMs - trialElapsed) / DAY_MS)) : 0;

  return {
    canLog: isSubscribed || trialActive,
    isSubscribed,
    isTrial: !isSubscribed && trialActive,
    trialExpired: !isSubscribed && trialStartedAt != null && !trialActive,
    trialNotStarted: !isSubscribed && trialStartedAt == null,
    trialDaysLeft,
    startTrial
  };
}
