export const PLAN_IDS = {
  INDIVIDUAL:        'com.numeline.app.individual_monthly',
  INDIVIDUAL_YEARLY: 'com.numeline.app.individual_yearly',
  ENTERPRISE:        'com.numeline.app.enterprise_monthly',
  ENTERPRISE_YEARLY: 'com.numeline.app.enterprise_yearly',
} as const;

export const PACK_IDS = {
  PACK_20:   'com.numeline.app.pack_20',
  PACK_120:  'com.numeline.app.pack_120',
  PACK_300:  'com.numeline.app.pack_300',
  PACK_600:  'com.numeline.app.pack_600',
  PACK_1500: 'com.numeline.app.pack_1500',
} as const;

export interface ScanPack {
  id: string;
  labelKey: string;
  quantity: number;
  price: string;
}

export const SCAN_PACKS: ScanPack[] = [
  { id: PACK_IDS.PACK_20,   labelKey: 'subscription.packs.p20',   quantity: 20,   price: '0,99 €'  },
  { id: PACK_IDS.PACK_120,  labelKey: 'subscription.packs.p120',  quantity: 120,  price: '2,99 €'  },
  { id: PACK_IDS.PACK_300,  labelKey: 'subscription.packs.p300',  quantity: 300,  price: '4,99 €'  },
  { id: PACK_IDS.PACK_600,  labelKey: 'subscription.packs.p600',  quantity: 600,  price: '9,99 €'  },
  { id: PACK_IDS.PACK_1500, labelKey: 'subscription.packs.p1500', quantity: 1500, price: '19,99 €' },
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
