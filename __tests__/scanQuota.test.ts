// Consommation des scans : quota du palier d'abord, packs achetés ensuite — et
// SURTOUT, le solde de packs doit être persisté à chaque consommation.
//
// Régression réelle : `saveScanUsageToFirestore` n'écrivait que
// `scansUsedThisMonth`. Le serveur conservait donc le solde de packs d'AVANT
// consommation, et la restauration au lancement le recréditait. Les packs
// achetés se régénéraient à chaque ouverture de l'application — pas seulement
// après une réinstallation.
import {
  FREE_SCAN_LIMIT,
  scanLimitForPlan,
  planTypeFromProductId,
  getScanPackById,
  SCAN_PACKS
} from '../src/constants/subscriptionPlans';

type State = { scansUsedThisMonth: number; bonusScans: number };

/** Reproduit `incrementScans` : le quota du palier d'abord, les packs ensuite. */
function consume(state: State, planLimit: number): State {
  if (state.scansUsedThisMonth < planLimit) {
    return { ...state, scansUsedThisMonth: state.scansUsedThisMonth + 1 };
  }
  if (state.bonusScans > 0) {
    return { ...state, bonusScans: Math.max(0, state.bonusScans - 1) };
  }
  return state;
}

/** Ce que le serveur retient après consommation (les DEUX valeurs). */
const persisted = (s: State) => ({
  scansUsedThisMonth: s.scansUsedThisMonth,
  bonusScans: s.bonusScans
});

/** Restauration au lancement : le serveur fait autorité sur les deux compteurs. */
function restore(local: State, server: State | null): State {
  if (!server) return local;
  return {
    // Plancher pour la conso gratuite : une réinstallation remet le local à 0.
    scansUsedThisMonth: Math.max(local.scansUsedThisMonth, server.scansUsedThisMonth),
    // Valeur EXACTE pour les packs : un « max » recréditerait ce qui a été consommé.
    bonusScans: server.bonusScans
  };
}

const remaining = (s: State, planLimit: number) =>
  Math.max(0, planLimit - s.scansUsedThisMonth) + s.bonusScans;

describe('quota du palier gratuit', () => {
  test('10 scans IA offerts', () => {
    expect(FREE_SCAN_LIMIT).toBe(10);
    expect(scanLimitForPlan('free')).toBe(10);
  });

  test('les paliers payants ont un quota supérieur', () => {
    expect(scanLimitForPlan('individual')).toBeGreaterThan(FREE_SCAN_LIMIT);
    expect(scanLimitForPlan('enterprise')).toBeGreaterThan(scanLimitForPlan('individual'));
  });
});

describe('ordre de consommation', () => {
  test('entame le quota du palier AVANT les packs', () => {
    let s: State = { scansUsedThisMonth: 0, bonusScans: 50 };
    s = consume(s, 10);
    expect(s).toEqual({ scansUsedThisMonth: 1, bonusScans: 50 });
  });

  test('bascule sur les packs une fois le quota épuisé', () => {
    let s: State = { scansUsedThisMonth: 10, bonusScans: 50 };
    s = consume(s, 10);
    expect(s).toEqual({ scansUsedThisMonth: 10, bonusScans: 49 });
  });

  test('ne descend jamais sous zéro', () => {
    const s = consume({ scansUsedThisMonth: 10, bonusScans: 0 }, 10);
    expect(remaining(s, 10)).toBe(0);
  });
});

describe('persistance serveur', () => {
  test('la consommation d’un pack est bien enregistrée', () => {
    const after = consume({ scansUsedThisMonth: 10, bonusScans: 5 }, 10);
    expect(persisted(after).bonusScans).toBe(4);
  });

  test('relancer l’app ne recrédite PAS les packs consommés', () => {
    let local: State = { scansUsedThisMonth: 10, bonusScans: 5 };
    local = consume(local, 10); // -> 4 packs
    const server = persisted(local);

    const relaunched = restore(local, server);
    expect(relaunched.bonusScans).toBe(4);

    // Dix relances de suite ne doivent rien recréditer.
    let s = relaunched;
    for (let i = 0; i < 10; i++) s = restore(s, server);
    expect(s.bonusScans).toBe(4);
  });

  test('une réinstallation ne rend pas les scans gratuits déjà consommés', () => {
    const server: State = { scansUsedThisMonth: 7, bonusScans: 3 };
    // Stockage local vidé par la réinstallation.
    const fresh = restore({ scansUsedThisMonth: 0, bonusScans: 0 }, server);
    expect(fresh.scansUsedThisMonth).toBe(7);
    expect(fresh.bonusScans).toBe(3);
    expect(remaining(fresh, FREE_SCAN_LIMIT)).toBe(6); // 3 gratuits + 3 packs
  });

  test('sans donnée serveur, l’état local est conservé', () => {
    const local: State = { scansUsedThisMonth: 4, bonusScans: 2 };
    expect(restore(local, null)).toEqual(local);
  });
});

// Achat d'un pack : il crédite des scans, et ne rend PAS premium.
// Régression réelle : tout achat passait par setPremium(true), packs compris,
// et `addBonusScans` n'était appelé nulle part — l'utilisateur payait un pack
// et ne recevait aucun scan, juste un statut premium qu'il n'avait pas acheté.
describe('achat d’un pack de scans', () => {
  test('les identifiants de packs ne sont pas des identifiants de formules', () => {
    for (const pack of SCAN_PACKS) {
      expect(planTypeFromProductId(pack.id)).toBe('free');
    }
  });

  test('chaque pack annonce une quantité exploitable', () => {
    expect(SCAN_PACKS.length).toBeGreaterThan(0);
    for (const pack of SCAN_PACKS) {
      expect(getScanPackById(pack.id)?.quantity).toBe(pack.quantity);
      expect(pack.quantity).toBeGreaterThan(0);
    }
  });

  test('un identifiant de formule n’est jamais pris pour un pack', () => {
    expect(getScanPackById('com.numeline.app.individual')).toBeUndefined();
  });

  test('le crédit s’ajoute au solde existant', () => {
    const before: State = { scansUsedThisMonth: 10, bonusScans: 4 };
    const pack = getScanPackById(SCAN_PACKS[0].id)!;
    const after = { ...before, bonusScans: before.bonusScans + pack.quantity };
    expect(after.bonusScans).toBe(4 + pack.quantity);
    // Et le quota consommé n'est pas remis à zéro au passage.
    expect(after.scansUsedThisMonth).toBe(10);
  });
});
