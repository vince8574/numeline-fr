/**
 * Script pour filtrer et extraire ~800 marques alimentaires françaises pertinentes
 * depuis brands.txt (395k marques) vers brands.json
 *
 * Critères de sélection:
 * 1. Marques françaises connues (liste prédéfinie)
 * 2. Marques de distributeurs français (Carrefour, Auchan, etc.)
 * 3. Marques internationales majeures vendues en France
 * 4. Filtrage des marques invalides (symboles, très courtes, etc.)
 */

const fs = require('fs');
const path = require('path');

// Marques françaises prioritaires (grandes marques alimentaires)
const FRENCH_PRIORITY_BRANDS = [
  // Produits laitiers
  'Danone', 'Activia', 'Actimel', 'Danonino', 'Gervais', 'Taillefine', 'Volvic', 'Evian', 'Badoit',
  'Président', 'Elle & Vire', 'Candia', 'Lactel', 'Bridel', 'Régilait',
  'Bonne Maman', 'St Mamet', 'Chambourcy', 'Yoplait', 'Perle de Lait', 'Panier de Yoplait',
  'Sveltesse', 'Fjord', 'Petits Filous', 'Kiri', 'Boursin', 'Caprice des Dieux',
  'Babybel', 'Vache qui rit', 'Apéricube', 'Leerdammer', 'Chaumes', 'Saint Agur',

  // Charcuterie
  'Fleury Michon', 'Herta', 'Justin Bridou', 'Cochonou', 'Aoste', 'Père Dodu',
  'Madrange', 'Bordeau Chesnel', 'Paysan Breton', 'La Nouvelle Agriculture',

  // Plats préparés & surgelés
  'Picard', 'Marie', 'Findus', 'Iglo', 'Bonduelle', 'Cassegrain', 'D\'Aucy',
  'Mousline', 'Maggi', 'Knorr', 'Royco', 'Liebig', 'Buitoni', 'Tipiak',
  'Lustucru', 'Panzani', 'Barilla', 'Rivoire & Carret', 'Zapetti',

  // Biscuits & confiserie
  'Lu', 'BN', 'Belvita', 'Granola', 'Prince', 'Pépito', 'Chamonix', 'Paille d\'Or',
  'St Michel', 'Bonne Maman', 'Gavottes', 'La Mère Poulard', 'Fossier',
  'Haribo', 'Lutti', 'Carambar', 'La Pie qui Chante', 'Krema', 'Werther\'s Original',

  // Chocolat
  'Lindt', 'Milka', 'Côte d\'Or', 'Nestlé', 'Galak', 'Lion', 'Crunch', 'KitKat',
  'Kinder', 'Ferrero', 'Nutella', 'Mon Chéri', 'Ferrero Rocher', 'Raffaello',
  'Toblerone', 'Suchard', 'Poulain', 'Menier', 'Banania',

  // Céréales & petit-déjeuner
  'Kellogg\'s', 'Nestlé', 'Chocapic', 'Nesquik', 'Fitness', 'Special K', 'Lion',
  'Trésor', 'Choco Pops', 'Miel Pops', 'Frosties', 'Corn Flakes', 'Smacks',
  'Jordans', 'Grany', 'Belvita', 'Gerblé', 'Bjorg', 'Gayelord Hauser',

  // Boissons
  'Coca-Cola', 'Pepsi', 'Orangina', 'Schweppes', 'Oasis', 'Tropicana', 'Minute Maid',
  'Lipton', 'Nestea', 'Arizona', 'Monster', 'Red Bull', 'Burn',
  'Teisseire', 'Pulco', 'Pago', 'Joker', 'Pampryl',

  // Marques de distributeurs (MDD)
  'Carrefour', 'Carrefour Bio', 'Carrefour Classic', 'Carrefour Selection', 'Carrefour Extra',
  'Auchan', 'Auchan Bio', 'Auchan Mieux Vivre', 'Auchan Gourmet',
  'Leclerc', 'E.Leclerc', 'Eco+', 'Marque Repère', 'Nos Régions ont du Talent',
  'U', 'U Bio', 'U Saveurs', 'Bien Vu',
  'Intermarché', 'Pâturages', 'Délisse', 'Monique Ranou',
  'Casino', 'Casino Bio', 'Terre & Saveur', 'Délices',
  'Monoprix', 'Monoprix Bio', 'Monoprix Gourmet',
  'Franprix', 'Leader Price', 'Ed', 'Dia',
  'Lidl', 'Alesto', 'Milbona', 'Fairglobe', 'Combino', 'Freeway', 'Chef Select',
  'Aldi', 'Meadow Fresh', 'Fairfield Farm', 'Moser Roth',
  'Cora', 'Cora Bio',

  // Bio & santé
  'Bjorg', 'Bonneterre', 'Jardin Bio', 'Alter Eco', 'Priméal', 'Celnat',
  'Naturalia', 'La Vie Claire', 'Biocoop', 'Soy', 'Sojasun', 'Alpro',
  'Gerblé', 'Gayelord Hauser', 'Weight Watchers',

  // Surgelés
  'Picard', 'Thiriet', 'Marie', 'Findus', 'Iglo',

  // Épicerie salée
  'Ducros', 'Vahiné', 'Alsa', 'Maïzena', 'Francine', 'Banania',
  'Amora', 'Maille', 'Bénédicta', 'Lesieur', 'Puget', 'Isio 4',
  'Heinz', 'La William Saurin', 'Raynal et Roquelaure', 'Géant Vert',

  // Café
  'Nespresso', 'L\'Or', 'Carte Noire', 'Jacques Vabre', 'Grand\'Mère', 'Maxwell',
  'Malongo', 'Lavazza', 'Illy', 'Senseo',

  // Thé & tisanes
  'Lipton', 'Éléphant', 'Kusmi Tea', 'Mariage Frères', 'Dammann Frères',
  'Twinings', 'Pagès', 'La Tisanière',

  // Apéritif
  'Benenuts', 'Vico', 'Lay\'s', 'Pringles', 'Curly', 'Tuc', 'Ritz', 'Monaco',
  'Brets', 'Pom-Deter', 'Traou Mad', 'Doritos', 'Bahlsen',

  // Glaces
  'Häagen-Dazs', 'Ben & Jerry\'s', 'Carte d\'Or', 'Miko', 'Extrême', 'Magnum',
  'Häagen-Dazs', 'La Laitière', 'Gervais',

  // Pain & viennoiseries
  'Harry\'s', 'La Mie Câline', 'Paul', 'Jacquet', 'Pasquier', 'Harrys American Sandwich',

  // Condiments
  'Heinz', 'Amora', 'Maille', 'Bénédicta', 'Lesieur',
];

// Mots-clés pour identifier les marques françaises
const FRENCH_KEYWORDS = [
  'France', 'Français', 'Paris', 'Lyon', 'Marseille', 'Bretagne', 'Normandie',
  'Auvergne', 'Savoie', 'Alsace', 'Provence', 'Languedoc', 'Bordeaux',
];

// Marques internationales majeures présentes en France
const INTERNATIONAL_MAJOR_BRANDS = [
  'Coca-Cola', 'Pepsi', 'Nestlé', 'Unilever', 'Mars', 'Mondelez',
  'Kraft', 'Heinz', 'Kellogg', 'General Mills', 'Barilla', 'Lavazza',
];

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
  /[؀-ۿ]/, // Arabe
];

/**
 * Vérifie si une marque doit être exclue
 */
function shouldExclude(brand) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(brand));
}

/**
 * Calcule un score de pertinence pour une marque
 * Plus le score est élevé, plus la marque est pertinente
 */
function calculateRelevanceScore(brand) {
  let score = 0;

  // Bonus si la marque est dans la liste prioritaire (case-insensitive)
  const brandLower = brand.toLowerCase();
  const priorityMatch = FRENCH_PRIORITY_BRANDS.find(
    pb => pb.toLowerCase() === brandLower
  );
  if (priorityMatch) {
    score += 100; // Score maximum pour marques prioritaires
  }

  // Bonus pour mots-clés français dans le nom
  if (FRENCH_KEYWORDS.some(kw => brand.includes(kw))) {
    score += 50;
  }

  // Bonus pour marques internationales majeures
  if (INTERNATIONAL_MAJOR_BRANDS.some(mb => brandLower.includes(mb.toLowerCase()))) {
    score += 40;
  }

  // Bonus pour longueur raisonnable (3-30 caractères)
  const length = brand.length;
  if (length >= 3 && length <= 30) {
    score += 20;
  } else if (length > 30) {
    score -= 10; // Pénalité pour noms très longs
  }

  // Bonus pour marques qui commencent par une majuscule (convention standard)
  if (/^[A-Z]/.test(brand)) {
    score += 10;
  }

  // Bonus pour absence de caractères spéciaux excessifs
  const specialCharsCount = (brand.match(/[^a-zA-Z0-9\s\-'&]/g) || []).length;
  if (specialCharsCount === 0) {
    score += 15;
  } else if (specialCharsCount > 3) {
    score -= 10;
  }

  // Pénalité pour noms avec beaucoup de chiffres
  const digitCount = (brand.match(/\d/g) || []).length;
  if (digitCount > 3) {
    score -= 15;
  }

  return score;
}

/**
 * Normalise un nom de marque
 */
function normalizeBrand(brand) {
  return brand.trim();
}

/**
 * Filtre et trie les marques
 */
function filterAndSortBrands(brands, targetCount = 800) {
  console.log(`📊 Traitement de ${brands.length} marques...`);

  // 1. Nettoyer et dédupliquer
  const uniqueBrands = [...new Set(brands.map(normalizeBrand))];
  console.log(`✓ Après déduplication: ${uniqueBrands.length} marques`);

  // 2. Exclure les marques invalides
  const validBrands = uniqueBrands.filter(brand => !shouldExclude(brand));
  console.log(`✓ Après exclusion des marques invalides: ${validBrands.length} marques`);

  // 3. Calculer les scores et trier
  const scoredBrands = validBrands.map(brand => ({
    name: brand,
    score: calculateRelevanceScore(brand)
  }));

  scoredBrands.sort((a, b) => b.score - a.score);

  // 4. Prendre le top N
  const topBrands = scoredBrands.slice(0, targetCount);

  console.log(`\n📈 Scores des 10 meilleures marques:`);
  topBrands.slice(0, 10).forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name} (score: ${b.score})`);
  });

  console.log(`\n📈 Scores des 10 dernières marques sélectionnées:`);
  topBrands.slice(-10).forEach((b, i) => {
    console.log(`  ${targetCount - 9 + i}. ${b.name} (score: ${b.score})`);
  });

  return topBrands.map(b => b.name);
}

/**
 * Fonction principale
 */
async function main() {
  const projectRoot = path.join(__dirname, '..');
  const inputFile = path.join(projectRoot, 'brands.txt');
  const outputFile = path.join(projectRoot, 'src', 'data', 'brands.json');

  console.log('🚀 Démarrage du filtrage des marques...\n');
  console.log(`📁 Fichier source: ${inputFile}`);
  console.log(`📁 Fichier destination: ${outputFile}\n`);

  // Lire le fichier brands.txt
  console.log('📖 Lecture du fichier brands.txt...');
  const content = fs.readFileSync(inputFile, 'utf8');
  const allBrands = content.split('\n').filter(line => line.trim());

  console.log(`✓ ${allBrands.length} marques lues\n`);

  // Filtrer et trier
  const filteredBrands = filterAndSortBrands(allBrands, 800);

  // Créer le répertoire si nécessaire
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Écrire le fichier JSON
  fs.writeFileSync(
    outputFile,
    JSON.stringify(filteredBrands, null, 2),
    'utf8'
  );

  console.log(`\n✅ ${filteredBrands.length} marques exportées vers ${outputFile}`);
  console.log('\n📊 Statistiques finales:');
  console.log(`  - Marques totales: ${allBrands.length}`);
  console.log(`  - Marques sélectionnées: ${filteredBrands.length}`);
  console.log(`  - Taux de sélection: ${(filteredBrands.length / allBrands.length * 100).toFixed(2)}%`);
}

// Exécution
main().catch(console.error);
