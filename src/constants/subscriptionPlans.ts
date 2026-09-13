export const PLAN_IDS = {
  INDIVIDUAL:        'com.numeline.app.individual_monthly',
  INDIVIDUAL_YEARLY: 'com.numeline.app.individual_yearly',
  ENTERPRISE:        'com.numeline.app.enterprise_monthly',
  ENTERPRISE_YEARLY: 'com.numeline.app.enterprise_yearly',
} as const;

export const PACK_IDS = {
  PACK_10:  'com.numeline.app.pack_10',
  PACK_50:  'com.numeline.app.pack_50',
  PACK_100: 'com.numeline.app.pack_100',
  PACK_210: 'com.numeline.app.pack_210',
} as const;

export interface ScanPack {
  id: string;
  labelKey: string;
  quantity: number;
  price: string;
}

// Affichage des packs de scans dans l'ecran d'abonnement.
// Mis a false : les packs ne sont plus proposes a la vente dans l'interface.
// La logique d'achat, la comptabilisation des credits et la restauration
// restent intactes -- un utilisateur ayant deja achete un pack conserve et
// voit son solde. Repasser a true suffit a les reafficher.
export const SHOW_SCAN_PACKS = false;

export const SCAN_PACKS: ScanPack[] = [
  { id: PACK_IDS.PACK_10,  labelKey: 'subscription.packs.p10',  quantity: 10,  price: '1,99 €'  },
  { id: PACK_IDS.PACK_50,  labelKey: 'subscription.packs.p50',  quantity: 50,  price: '5,99 €'  },
  { id: PACK_IDS.PACK_100, labelKey: 'subscription.packs.p100', quantity: 100, price: '9,99 €'  },
  { id: PACK_IDS.PACK_210, labelKey: 'subscription.packs.p210', quantity: 210, price: '19,99 €' },
];

export type PlanType = 'free' | 'individual' | 'enterprise';

// ─── Quotas du palier GRATUIT ────────────────────────────────────────────────
// Scan IA du lot : 10 offerts au téléchargement, à vie. C'est la ressource
// coûteuse (~0,02-0,04 $/scan) → jamais réinitialisée (cf. resetQuotaIfNeeded),
// donc attribués UNE SEULE FOIS. Un seul scan ne laissait pas le temps de
// comprendre ce que fait l'application avant de se heurter au paywall.
export const FREE_SCAN_LIMIT = 10;
// Scan de code-barres : 10 par mois, réinitialisés le 1er de chaque mois.
export const FREE_BARCODE_MONTHLY_LIMIT = 10;
// Saisie MANUELLE du lot : 9 le 1er mois, puis 10 par mois. Compteur totalement
// indépendant du scan IA. (Le 9 datait de l'époque où le téléchargement n'offrait
// qu'UN scan IA, pour arriver à 10 vérifications au total.)
export const FREE_MANUAL_LOT_FIRST_MONTH = 9;
export const FREE_MANUAL_LOT_MONTHLY = 10;

// ─── Quotas des paliers PAYANTS ──────────────────────────────────────────────
// Le scan IA reste plafonné (coût) ; code-barres et lot manuel sont illimités.
export const INDIVIDUAL_SCAN_LIMIT = 100;
export const ENTERPRISE_SCAN_LIMIT = 500;
export const ENTERPRISE_HISTORY_DAYS = 180;

export function planTypeFromProductId(productId: string | null): PlanType {
  if (productId === PLAN_IDS.ENTERPRISE || productId === PLAN_IDS.ENTERPRISE_YEARLY) return 'enterprise';
  if (productId === PLAN_IDS.INDIVIDUAL || productId === PLAN_IDS.INDIVIDUAL_YEARLY) return 'individual';
  return 'free';
}

export function scanLimitForPlan(plan: PlanType): number {
  if (plan === 'enterprise') return ENTERPRISE_SCAN_LIMIT;
  if (plan === 'individual') return INDIVIDUAL_SCAN_LIMIT;
  return FREE_SCAN_LIMIT;
}

export function getScanPackById(packId: string): ScanPack | undefined {
  return SCAN_PACKS.find((p) => p.id === packId);
}
