// Catalogue d'ingrédients (façon Fig) construit à partir de la taxonomie ouverte
// Open Food Facts (ODbL) : ~3 000 ingrédients génériques, avec leur tag canonique
// (`en:wheat`) et leurs noms (en + fr). Utilisé pour la RECHERCHE dans l'éditeur de
// profil ; le matching se fait ensuite par tag canonique + repli mot-clé sur le nom.
import rawCatalog from '../data/ingredientCatalog.json';

export type CatalogEntry = {
  id: string; // tag canonique OFF, ex. "en:wheat"
  n: { en: string; fr?: string };
};

export const INGREDIENT_CATALOG = rawCatalog as CatalogEntry[];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Nom d'affichage dans la langue de l'utilisateur (repli anglais).
export function catalogName(e: CatalogEntry, locale?: string): string {
  return locale && locale.startsWith('fr') && e.n.fr ? e.n.fr : e.n.en;
}

// Pré-index normalisé (calculé une fois) : nom EN + FR minuscules sans accents.
const INDEX = INGREDIENT_CATALOG.map((e) => ({
  e,
  hay: norm(e.n.en) + (e.n.fr ? ' ' + norm(e.n.fr) : '')
}));

// Recherche type-ahead : les correspondances en DÉBUT de mot d'abord, puis le reste.
export function searchCatalog(query: string, locale?: string, limit = 30): CatalogEntry[] {
  const q = norm(query.trim());
  if (q.length < 2) return [];
  const starts: CatalogEntry[] = [];
  const contains: CatalogEntry[] = [];
  for (const { e, hay } of INDEX) {
    const i = hay.indexOf(q);
    if (i === -1) continue;
    const atWordStart = i === 0 || hay[i - 1] === ' ';
    (atWordStart ? starts : contains).push(e);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
