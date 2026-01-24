/**
 * Script pour extraire ~20 000 marques uniques et normalisées
 * depuis brands.txt (395k marques) vers brands.json
 *
 * Stratégie:
 * 1. Normaliser les marques (casse, accents, espaces)
 * 2. Dédupliquer en gardant la version la plus propre
 * 3. Filtrer les codes invalides
 * 4. Garder ~20 000 marques de qualité
 */

const fs = require('fs');
const path = require('path');

// Patterns à exclure (marques invalides, codes, etc.)
const EXCLUDE_PATTERNS = [
  /^[^a-zA-Z]/, // Commence par un symbole/chiffre
  /^[\(\[\{]/, // Commence par une parenthèse
  /^#/, // Hashtags
  /^%/, // Pourcentages
  /^&[a-z]/, // Codes HTML
  /^\d+$/, // Que des chiffres
  /^[a-z]$/, // Une seule lettre minuscule
  /^.{1,2}$/, // Trop court (1-2 caractères)
  /\ud800-\udfff/, // Caractères Unicode invalides
  /[א-ת]/, // Hébreu
  /[а-яА-Я]/, // Cyrillique
  /[一-龯]/, // Chinois/Japonais
  /[가-힣]/, // Coréen
  /[ก-๙]/, // Thaï
  /^[A-Z0-9]{10,}$/, // Codes longs (probablement des EAN)
  /^\w+-\d{5,}/, // Codes produits
];

/**
 * Normalise une chaîne pour la comparaison
 * (minuscules, sans accents, sans espaces multiples)
 */
function normalizeForComparison(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
    .replace(/['\-]/g, '') // Enlever apostrophes et tirets
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();
}

/**
 * Vérifie si une marque doit être exclue
 */
function shouldExclude(brand) {
  if (!brand || brand.length === 0) return true;

  // Exclure si correspond aux patterns
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(brand))) {
    return true;
  }

  // Exclure si trop long (probablement une description)
  if (brand.length > 50) return true;

  // Exclure si trop de caractères spéciaux
  const specialCharsCount = (brand.match(/[^a-zA-Z0-9\s\-'&]/g) || []).length;
  if (specialCharsCount > 5) return true;

  // Exclure si que des chiffres et symboles
  if (!/[a-zA-Z]{2,}/.test(brand)) return true;

  return false;
}

/**
 * Score de "propreté" d'une marque
 * Plus le score est élevé, plus la marque est propre/standard
 */
function cleanlinessScore(brand) {
  let score = 0;

  // Préférer les marques qui commencent par une majuscule
  if (/^[A-Z]/.test(brand)) score += 30;

  // Préférer les marques avec casse mixte appropriée (CamelCase ou Title Case)
  if (/^[A-Z][a-z]+/.test(brand)) score += 20;

  // Préférer les marques sans caractères spéciaux excessifs
  const specialChars = (brand.match(/[^a-zA-Z0-9\s]/g) || []).length;
  score -= specialChars * 5;

  // Préférer les marques de longueur moyenne (5-20 caractères)
  const len = brand.length;
  if (len >= 5 && len <= 20) score += 15;

  // Pénaliser les marques tout en majuscules (probablement des acronymes)
  if (brand === brand.toUpperCase() && brand.length > 3) score -= 10;

  // Pénaliser les marques tout en minuscules
  if (brand === brand.toLowerCase()) score -= 10;

  // Préférer les marques sans chiffres
  if (!/\d/.test(brand)) score += 10;

  // Préférer les marques sans espaces (noms de marque simples)
  if (!/\s/.test(brand)) score += 5;

  return score;
}

/**
 * Déduplique et nettoie les marques
 */
function deduplicateAndClean(brands, targetCount = 20000) {
  console.log(`📊 Traitement de ${brands.length} marques...`);

  // 1. Filtrer les marques invalides
  const validBrands = brands.filter(brand => !shouldExclude(brand.trim()));
  console.log(`✓ Après filtrage: ${validBrands.length} marques valides`);

  // 2. Grouper les marques par version normalisée
  const brandGroups = new Map();

  for (const brand of validBrands) {
    const normalized = normalizeForComparison(brand);

    if (!brandGroups.has(normalized)) {
      brandGroups.set(normalized, []);
    }
    brandGroups.get(normalized).push(brand.trim());
  }

  console.log(`✓ ${brandGroups.size} marques uniques trouvées`);

  // 3. Pour chaque groupe, choisir la meilleure version
  const uniqueBrands = [];

  for (const [normalized, variants] of brandGroups.entries()) {
    // Trier par score de propreté (décroissant)
    variants.sort((a, b) => cleanlinessScore(b) - cleanlinessScore(a));

    // Prendre la meilleure version
    const bestVariant = variants[0];

    uniqueBrands.push({
      name: bestVariant,
      normalized: normalized,
      score: cleanlinessScore(bestVariant),
      variants: variants.length
    });
  }

  // 4. Trier par score de propreté et prendre le top N
  uniqueBrands.sort((a, b) => b.score - a.score);

  const selectedBrands = uniqueBrands.slice(0, targetCount);

  console.log(`\n📈 Top 10 marques (par score de propreté):`);
  selectedBrands.slice(0, 10).forEach((b, i) => {
    console.log(`  ${i + 1}. "${b.name}" (score: ${b.score}, variants: ${b.variants})`);
  });

  console.log(`\n📈 Dernières marques sélectionnées:`);
  selectedBrands.slice(-10).forEach((b, i) => {
    const rank = targetCount - 9 + i;
    console.log(`  ${rank}. "${b.name}" (score: ${b.score}, variants: ${b.variants})`);
  });

  return selectedBrands.map(b => b.name);
}

/**
 * Fonction principale
 */
async function main() {
  const projectRoot = path.join(__dirname, '..');
  const inputFile = path.join(projectRoot, 'brands.txt');
  const outputFile = path.join(projectRoot, 'src', 'data', 'brands.json');

  console.log('🚀 Génération de la liste complète des marques...\n');
  console.log(`📁 Source: ${inputFile}`);
  console.log(`📁 Destination: ${outputFile}\n`);

  // Lire le fichier brands.txt
  console.log('📖 Lecture du fichier brands.txt...');
  const content = fs.readFileSync(inputFile, 'utf8');
  const allBrands = content.split('\n').filter(line => line.trim());

  console.log(`✓ ${allBrands.length} marques lues\n`);

  // Dédupliquer et nettoyer - toutes les marques uniques
  const finalBrands = deduplicateAndClean(allBrands, 999999);

  // Trier alphabétiquement pour faciliter la recherche
  finalBrands.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  // Créer le répertoire si nécessaire
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Écrire le fichier JSON
  fs.writeFileSync(
    outputFile,
    JSON.stringify(finalBrands, null, 2),
    'utf8'
  );

  console.log(`\n✅ ${finalBrands.length} marques exportées vers ${outputFile}`);

  // Calculer la taille du fichier
  const stats = fs.statSync(outputFile);
  const fileSizeKB = (stats.size / 1024).toFixed(2);

  console.log('\n📊 Statistiques finales:');
  console.log(`  - Marques totales dans brands.txt: ${allBrands.length}`);
  console.log(`  - Marques uniques sélectionnées: ${finalBrands.length}`);
  console.log(`  - Taille du fichier JSON: ${fileSizeKB} KB`);
  console.log(`  - Taux de compression: ${((1 - finalBrands.length / allBrands.length) * 100).toFixed(1)}%`);
}

// Exécution
main().catch(console.error);
