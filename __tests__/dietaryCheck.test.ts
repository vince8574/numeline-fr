// nanoid/non-secure ships ESM that jest-expo's transformIgnorePatterns doesn't
// transform → stub it (dietaryProfile.ts only uses it to mint person ids).
jest.mock('nanoid/non-secure', () => ({ nanoid: () => 'test-id' }));

import {
  checkProductAgainstProfile,
  type ProductDietaryData
} from '../src/services/dietaryCheckService';
import type { DietaryProfile, DietaryPerson, AllergenKey } from '../src/services/dietaryProfile';
import {
  ALLERGEN_INGREDIENT_KEYWORDS,
  AVOID_FOODS,
  PREGNANCY_RISKS
} from '../src/services/dietaryProfile';

const person = (o: Partial<DietaryPerson>): DietaryPerson => ({
  id: 'p1',
  name: 'Test',
  allergens: [],
  avoidFoods: [],
  avoidIngredients: [],
  customAvoidFoods: [],
  vegetarian: false,
  vegan: false,
  pregnant: false,
  celiac: false,
  thresholds: {},
  ...o
});

const prof = (p: DietaryPerson): DietaryProfile =>
  ({ people: [p], updatedAt: 0 } as DietaryProfile);

describe('dietaryCheck — détection code-barres non fiable (aucune donnée d’ingrédients)', () => {
  it('nomme chaque allergène / aliment évité en suspicion de trace (warn), pas un « unknown » muet', () => {
    const product: ProductDietaryData = { productName: 'Produit inconnu' };
    const res = checkProductAgainstProfile(product, prof(person({ allergens: ['milk'], avoidFoods: ['pork'] })));
    expect(res.status).toBe('warn');
    const milk = res.warnings.find((w) => w.type === 'trace' && w.key === 'milk');
    expect(milk?.unverified).toBe(true);
    expect(milk?.level).toBe('warn');
    const pork = res.warnings.find((w) => w.type === 'avoidFood' && w.key === 'pork');
    expect(pork?.unverified).toBe(true);
  });

  it('cœliaque : gluten non vérifiable devient une suspicion de trace (warn)', () => {
    const res = checkProductAgainstProfile({ productName: 'X' }, prof(person({ celiac: true })));
    const g = res.warnings.find((w) => w.type === 'trace' && w.key === 'gluten' && w.unverified);
    expect(g?.level).toBe('warn');
  });

  it('n’ajoute PAS de suspicion quand le produit A des données d’ingrédients', () => {
    const res = checkProductAgainstProfile({ ingredientsText: 'eau, sucre, sel' }, prof(person({ allergens: ['milk'] })));
    expect(res.warnings.some((w) => w.unverified)).toBe(false);
  });
});

describe('dietaryCheck — pork false positive (rennet / présure)', () => {
  it('does NOT flag pork for a gorgonzola whose ingredients list "présure"', () => {
    const product: ProductDietaryData = {
      productName: 'Mascarpone & Gorgonzola',
      ingredientsText:
        'Crème de lait de vache, acide citrique, gorgonzola (lait pasteurisé de vache, sel, présure).'
    };
    const res = checkProductAgainstProfile(product, prof(person({ avoidFoods: ['pork'] })));
    expect(res.warnings.some((w) => w.key === 'pork')).toBe(false);
  });

  it('still flags real pork (jambon)', () => {
    const res = checkProductAgainstProfile(
      { ingredientsText: 'jambon, sel, conservateur' },
      prof(person({ avoidFoods: ['pork'] }))
    );
    expect(res.warnings.some((w) => w.key === 'pork')).toBe(true);
  });
});

describe('dietaryCheck — pregnancy raw meat / smoked fish via product NAME', () => {
  it('flags a beef carpaccio (raw meat only named in the title) for a pregnant person', () => {
    const product: ProductDietaryData = {
      productName: 'Carpaccio de bœuf',
      ingredientsText: "Viande de bœuf, huile d'olive, sel, poivre."
    };
    const res = checkProductAgainstProfile(product, prof(person({ pregnant: true })));
    const w = res.warnings.find((x) => x.type === 'pregnancy' && x.key === 'raw-meat');
    expect(w).toBeTruthy();
    expect(res.status).toBe('danger');
  });

  it('flags smoked salmon (named "Saumon fumé", not in ingredients) for a pregnant person', () => {
    const product: ProductDietaryData = {
      productName: 'Saumon fumé',
      ingredientsText: 'Saumon (Salmo salar), sel.' // no "fumé" here
    };
    const res = checkProductAgainstProfile(product, prof(person({ pregnant: true })));
    expect(res.warnings.some((w) => w.type === 'pregnancy' && w.key === 'raw-fish')).toBe(true);
  });

  it('flags a raw-milk cheese (OFF markup "_Lait_ cru") as raw-milk danger', () => {
    const product: ProductDietaryData = {
      productName: 'Cantal Entre-Deux AOP',
      // Open Food Facts wraps recognised ingredients in underscores → "_Lait_ cru"
      // must still match the "lait cru" keyword.
      ingredientsText: "_Lait_ cru de vache issu de l'AOP du Cantal, sel, ferments, présure animale."
    };
    const res = checkProductAgainstProfile(product, prof(person({ pregnant: true })));
    expect(res.warnings.some((w) => w.type === 'pregnancy' && w.key === 'raw-milk')).toBe(true);
    expect(res.status).toBe('danger');
  });

  it('does NOT flag "sauce tartare" as raw meat', () => {
    const res = checkProductAgainstProfile(
      { productName: 'Sauce tartare', ingredientsText: 'huile, moutarde, cornichons, câpres' },
      prof(person({ pregnant: true }))
    );
    expect(res.warnings.some((w) => w.key === 'raw-meat')).toBe(false);
  });
});

describe('dietaryCheck — celiac (strict gluten avoidance)', () => {
  it('flags the gluten allergen as danger for a celiac person', () => {
    const res = checkProductAgainstProfile({ allergensTags: ['en:gluten'] }, prof(person({ celiac: true })));
    expect(res.warnings.some((w) => w.type === 'celiac')).toBe(true);
    expect(res.status).toBe('danger');
  });

  it('flags gluten TRACES as danger for a celiac (stricter than a normal allergen)', () => {
    const res = checkProductAgainstProfile({ tracesTags: ['en:gluten'] }, prof(person({ celiac: true })));
    expect(res.warnings.some((w) => w.type === 'celiac' && w.level === 'danger')).toBe(true);
  });

  it('does NOT flag celiac when there is no gluten', () => {
    const res = checkProductAgainstProfile({ ingredientsText: 'Sucre, sel.' }, prof(person({ celiac: true })));
    expect(res.warnings.some((w) => w.type === 'celiac')).toBe(false);
  });
});

describe('dietaryCheck — catalog ingredient (hybrid: tag + name)', () => {
  it('matches by EXACT canonical tag (product ingredientsTags)', () => {
    const res = checkProductAgainstProfile(
      { ingredientsTags: ['en:sugar', 'en:wheat', 'en:salt'] },
      prof(person({ avoidIngredients: [{ id: 'en:wheat', name: 'blé' }] }))
    );
    expect(res.warnings.some((w) => w.type === 'custom')).toBe(true);
    expect(res.status).toBe('danger');
  });

  it('falls back to the NAME keyword when the product is not taxonomised', () => {
    const res = checkProductAgainstProfile(
      { ingredientsText: 'Farine de blé, sucre, sel.' },
      prof(person({ avoidIngredients: [{ id: 'en:wheat', name: 'blé' }] }))
    );
    expect(res.warnings.some((w) => w.type === 'custom' && w.key === 'blé')).toBe(true);
  });

  it('does not match when neither tag nor name is present', () => {
    const res = checkProductAgainstProfile(
      { ingredientsText: 'Sucre, sel.', ingredientsTags: ['en:sugar', 'en:salt'] },
      prof(person({ avoidIngredients: [{ id: 'en:wheat', name: 'blé' }] }))
    );
    expect(res.warnings.some((w) => w.type === 'custom')).toBe(false);
  });
});

describe('dietaryCheck — sulphites keyword fallback', () => {
  it('flags E220 / "dioxyde de soufre" in text even without the OFF allergen tag', () => {
    const res = checkProductAgainstProfile(
      { ingredientsText: 'Raisins secs, conservateur : dioxyde de soufre (E220).' },
      prof(person({ allergens: ['sulphur-dioxide-and-sulphites'] }))
    );
    expect(res.warnings.some((w) => w.type === 'allergen' && w.key === 'sulphur-dioxide-and-sulphites')).toBe(true);
  });
});

describe('dietaryCheck — custom user-entered ingredient', () => {
  it('flags a custom ingredient found in the ingredients (danger)', () => {
    const res = checkProductAgainstProfile(
      { ingredientsText: 'Sucre, curcuma, sel.' },
      prof(person({ customAvoidFoods: ['curcuma'] }))
    );
    expect(res.warnings.some((w) => w.type === 'custom' && w.key === 'curcuma')).toBe(true);
    expect(res.status).toBe('danger');
  });

  it('does not flag a custom ingredient that is absent', () => {
    const res = checkProductAgainstProfile(
      { ingredientsText: 'Sucre, sel.' },
      prof(person({ customAvoidFoods: ['curcuma'] }))
    );
    expect(res.warnings.some((w) => w.type === 'custom')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Vérification EXHAUSTIVE : le markup OFF ("_mot_") ne doit casser AUCUN mot-clé
// multi-mots. Pour chaque mot-clé contenant un espace, on simule OFF en entourant
// le PREMIER mot d'underscores (le cas réel qui cassait "lait cru" -> "_lait_ cru")
// et on vérifie que la détection se déclenche quand même.
// ---------------------------------------------------------------------------
const offWrapFirst = (kw: string): string => {
  const parts = kw.split(' ');
  if (parts.length < 2) return kw;
  return `_${parts[0]}_ ${parts.slice(1).join(' ')}`;
};

describe('OFF underscore markup — every multi-word keyword still matches', () => {
  for (const [allergen, kws] of Object.entries(ALLERGEN_INGREDIENT_KEYWORDS)) {
    for (const kw of (kws as string[]).filter((k) => k.includes(' '))) {
      it(`allergen "${allergen}" / "${kw}"`, () => {
        const res = checkProductAgainstProfile(
          { ingredientsText: offWrapFirst(kw) },
          prof(person({ allergens: [allergen as AllergenKey] }))
        );
        expect(res.warnings.some((w) => w.type === 'allergen' && w.key === allergen)).toBe(true);
      });
    }
  }

  for (const def of AVOID_FOODS) {
    for (const kw of def.keywords.filter((k) => k.includes(' '))) {
      it(`avoidFood "${def.key}" / "${kw}"`, () => {
        const res = checkProductAgainstProfile(
          { ingredientsText: offWrapFirst(kw) },
          prof(person({ avoidFoods: [def.key] }))
        );
        expect(res.warnings.some((w) => w.type === 'avoidFood' && w.key === def.key)).toBe(true);
      });
    }
  }

  for (const risk of PREGNANCY_RISKS) {
    for (const kw of risk.keywords.filter((k) => k.includes(' '))) {
      it(`pregnancy "${risk.key}" / "${kw}"`, () => {
        const res = checkProductAgainstProfile(
          { ingredientsText: offWrapFirst(kw) },
          prof(person({ pregnant: true }))
        );
        expect(res.warnings.some((w) => w.type === 'pregnancy' && w.key === risk.key)).toBe(true);
      });
    }
  }
});
