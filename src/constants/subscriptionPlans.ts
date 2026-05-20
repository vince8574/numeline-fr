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

export const SCAN_PACKS: ScanPack[] = [
  { id: PACK_IDS.PACK_10,  labelKey: 'subscription.packs.p10',  quantity: 10,  price: '0,99 €'  },
  { id: PACK_IDS.PACK_50,  labelKey: 'subscription.packs.p50',  quantity: 50,  price: '4,99 €'  },
  { id: PACK_IDS.PACK_100, labelKey: 'subscription.packs.p100', quantity: 100, price: '9,99 €'  },
  { id: PACK_IDS.PACK_210, labelKey: 'subscription.packs.p210', quantity: 210, price: '19,99 €' },
];

export type PlanType = 'free' | 'individual' | 'enterprise';

export const FREE_SCAN_LIMIT = 2;
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
