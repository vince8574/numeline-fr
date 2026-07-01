// Libellés FR du profil alimentaire, partagés par l'écran de config et le bandeau
// d'alerte de scan. (La localisation multi-langue pourra passer par i18n plus tard.)
import type { AllergenKey, NutrientKey } from './dietaryProfile';

export const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  gluten: 'Gluten',
  milk: 'Lait',
  eggs: 'Œufs',
  nuts: 'Fruits à coque',
  peanuts: 'Arachides',
  soybeans: 'Soja',
  fish: 'Poisson',
  crustaceans: 'Crustacés',
  molluscs: 'Mollusques',
  celery: 'Céleri',
  mustard: 'Moutarde',
  'sesame-seeds': 'Sésame',
  'sulphur-dioxide-and-sulphites': 'Sulfites',
  lupin: 'Lupin'
};

export const FOOD_LABELS: Record<string, string> = {
  pork: 'Porc',
  seafood: 'Fruits de mer',
  alcohol: 'Alcool',
  beef: 'Bœuf',
  gelatin: 'Gélatine'
};

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  sugars: 'Sucres',
  fat: 'Matières grasses',
  'saturated-fat': 'Acides gras saturés',
  salt: 'Sel'
};

export const DIET_LABELS: Record<string, string> = {
  vegetarian: 'Végétarien',
  vegan: 'Végan'
};

export function allergenLabel(key: string): string {
  return ALLERGEN_LABELS[key as AllergenKey] ?? key;
}
export function foodLabel(key: string): string {
  return FOOD_LABELS[key] ?? key;
}
export function nutrientLabel(key: string): string {
  return NUTRIENT_LABELS[key as NutrientKey] ?? key;
}
