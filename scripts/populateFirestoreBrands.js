// Populate Firestore with brands from brands.json + Rappel Conso API
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../firebase-admin-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('❌ Error: firebase-admin-key.json not found');
  console.error('Download it from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const db = admin.firestore();

// Normalize brand name for indexing
function normalizeBrand(brand) {
  return brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Get first letter for grouping
function getFirstLetter(brand) {
  const normalized = normalizeBrand(brand);
  const firstChar = normalized.charAt(0);
  return /[a-z]/.test(firstChar) ? firstChar : '0'; // Numbers and special chars go to '0'
}

// Fetch brands from Rappel Conso API
async function fetchRappelConsoBrands() {
  return new Promise((resolve, reject) => {
    console.log('📡 Fetching brands from Rappel Conso API...');

    const options = {
      hostname: 'data.economie.gouv.fr',
      path: '/api/explore/v2.1/catalog/datasets/rappelconso0/records?limit=100&select=noms_des_modeles_ou_references',
      method: 'GET',
      headers: { 'User-Agent': 'EatsOK/1.0' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const brands = new Set();

          json.results?.forEach(record => {
            const brand = record.noms_des_modeles_ou_references;
            if (brand && typeof brand === 'string' && brand.length > 1) {
              brands.add(brand.trim());
            }
          });

          console.log(`✓ Found ${brands.size} unique brands from Rappel Conso`);
          resolve(Array.from(brands));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Main function
async function main() {
  console.log('🚀 Starting Firestore brands population...\n');

  // Load brands from local file
  const brandsPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'brands.json');
  console.log('📂 Loading brands from brands.json...');
  const localBrands = JSON.parse(fs.readFileSync(brandsPath, 'utf-8'));
  console.log(`✓ Loaded ${localBrands.length} brands from local file\n`);

  // Fetch from Rappel Conso
  let rappelConsoBrands = [];
  try {
    rappelConsoBrands = await fetchRappelConsoBrands();
  } catch (error) {
    console.warn('⚠️  Failed to fetch from Rappel Conso:', error.message);
  }

  // Combine and deduplicate
  const allBrandsSet = new Set([...localBrands, ...rappelConsoBrands]);
  const allBrands = Array.from(allBrandsSet).sort();
  console.log(`\n📊 Total unique brands: ${allBrands.length}`);

  // Group by first letter
  const brandsByLetter = {};
  allBrands.forEach(brand => {
    const letter = getFirstLetter(brand);
    if (!brandsByLetter[letter]) {
      brandsByLetter[letter] = [];
    }
    brandsByLetter[letter].push(brand);
  });

  console.log(`\n📝 Grouped into ${Object.keys(brandsByLetter).length} categories\n`);

  // Upload to Firestore with chunking for large letters
  const MAX_BRANDS_PER_DOC = 15000; // Safe limit under Firestore's 40k index limit
  let totalDocuments = 0;

  for (const [letter, brands] of Object.entries(brandsByLetter)) {
    // Split large letter groups into multiple documents
    const chunks = [];
    for (let i = 0; i < brands.length; i += MAX_BRANDS_PER_DOC) {
      chunks.push(brands.slice(i, i + MAX_BRANDS_PER_DOC));
    }

    console.log(`  ✓ Letter "${letter}": ${brands.length} brands (${chunks.length} chunk${chunks.length > 1 ? 's' : ''})`);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const docId = chunks.length > 1 ? `${letter}_${chunkIndex}` : letter;
      const docRef = db.collection('brands').doc(docId);

      await docRef.set({
        brands: chunk,
        count: chunk.length,
        letter: letter,
        chunkIndex: chunkIndex,
        totalChunks: chunks.length,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      totalDocuments++;
      console.log(`    → Document "${docId}": ${chunk.length} brands`);
    }
  }

  // Create metadata document
  await db.collection('brands').doc('_metadata').set({
    totalBrands: allBrands.length,
    totalDocuments: totalDocuments,
    categories: Object.keys(brandsByLetter).length,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    sources: {
      openFoodFacts: localBrands.length,
      rappelConso: rappelConsoBrands.length
    }
  });

  console.log(`\n✅ Successfully populated Firestore with ${allBrands.length} brands!`);
  console.log(`📦 Created ${totalDocuments} documents in 'brands' collection`);

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
