import { useSubscriptionStore, currentMonthKey } from '../stores/useSubscriptionStore';
import { useUserStore } from '../stores/useUserStore';
import { saveScanUsageToFirestore } from '../services/firestoreSubscriptionService';
import {
  scanLimitForPlan,
  FREE_BARCODE_MONTHLY_LIMIT,
  FREE_MANUAL_LOT_FIRST_MONTH,
  FREE_MANUAL_LOT_MONTHLY
} from '../constants/subscriptionPlans';

export function useSubscription() {
  const store = useSubscriptionStore();

  store.resetQuotaIfNeeded();

  // planType may be absent in stores persisted before this field was added
  const planType = store.planType ?? (store.isPremium ? 'individual' : 'free');
  const planLimit = scanLimitForPlan(planType);
  const bonusScans = store.bonusScans ?? 0;
  const isPremium = store.isPremium;

  // ─── Scan IA du lot (ressource coûteuse) ───────────────────────────────────
  // Gratuit : 1 à vie. Abonné : quota mensuel du plan (100/500).
  const planScansRemaining = Math.max(0, planLimit - store.scansUsedThisMonth);
  const scansRemaining = planScansRemaining + bonusScans;
  const canScan = scansRemaining > 0;
  const isEnterprise = planType === 'enterprise';

  // ─── Scan de code-barres ───────────────────────────────────────────────────
  // Abonné : illimité. Gratuit : 10/mois.
  const barcodeUsed = store.barcodeUsedThisMonth ?? 0;
  const barcodeLimit = isPremium ? Infinity : FREE_BARCODE_MONTHLY_LIMIT;
  const barcodeRemaining = isPremium ? Infinity : Math.max(0, barcodeLimit - barcodeUsed);
  const canScanBarcode = isPremium || barcodeRemaining > 0;

  // ─── Saisie manuelle du lot ────────────────────────────────────────────────
  // Abonné : illimitée. Gratuit : 9 le 1er mois (1 scan IA + 9 manuels = 10
  // vérifications), puis 10/mois.
  const manualLotUsed = store.manualLotUsedThisMonth ?? 0;
  const isFirstMonth = (store.installMonthKey ?? currentMonthKey()) === currentMonthKey();
  // Saisie MANUELLE du lot : ILLIMITÉE pour tout le monde. Elle n'appelle aucun
  // modèle et n'interroge que des bases publiques — elle ne coûte rien à servir.
  // Seuls le scan IA du lot et la détection d'allergènes relèvent de
  // l'abonnement ou des packs. Le plafond qui existait ici privait de
  // vérification des utilisateurs à qui elle ne coûtait rien.
  const manualLotLimit = Infinity;
  const manualLotRemaining = Infinity;
  const canManualLot = true;

  // Consumes plan scans first, then bonus scans
  const incrementScans = () => {
    if (store.scansUsedThisMonth < planLimit) {
      store.incrementScans();
    } else if (bonusScans > 0) {
      store.consumeBonusScan();
    }
    // Persiste la conso côté serveur : quota gratuit ET solde de packs. Le solde
    // manquait, si bien que le serveur gardait la valeur d'avant consommation et
    // la restauration au lancement recréditait les packs achetés.
    const uid = useUserStore.getState().uid;
    if (uid) {
      const after = useSubscriptionStore.getState();
      void saveScanUsageToFirestore(uid, after.scansUsedThisMonth, after.bonusScans);
    }
  };

  // Compteurs mensuels : inutile de décompter pour un abonné (illimité).
  const incrementBarcode = () => {
    if (!isPremium) store.incrementBarcode();
  };

  const incrementManualLot = () => {
    if (!isPremium) store.incrementManualLot();
  };

  return {
    canScan,
    scansRemaining,
    planScansRemaining,
    bonusScans,
    scansUsed: store.scansUsedThisMonth,
    scanLimit: planLimit,
    isPremium,
    planType,
    isEnterprise,
    canExport: isEnterprise,
    incrementScans,
    // Code-barres
    canScanBarcode,
    barcodeUsed,
    barcodeLimit,
    barcodeRemaining,
    incrementBarcode,
    // Lot manuel
    canManualLot,
    manualLotUsed,
    manualLotLimit,
    manualLotRemaining,
    incrementManualLot,
  };
}
