// Split brands.json into multiple smaller files to avoid Metro bundler issues
const fs = require('fs');
const path = require('path');

const BRANDS_PER_FILE = 30000; // ~30k brands per file (~600KB each)
const INPUT_FILE = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'brands.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'data');

console.log('📦 Splitting brands.json into multiple files...');

// Read the full brands list
const allBrands = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
console.log(`✓ Loaded ${allBrands.length} brands from ${INPUT_FILE}`);

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Split into chunks
const chunks = [];
for (let i = 0; i < allBrands.length; i += BRANDS_PER_FILE) {
  chunks.push(allBrands.slice(i, i + BRANDS_PER_FILE));
}

console.log(`✓ Split into ${chunks.length} files (${BRANDS_PER_FILE} brands per file)`);

// Write each chunk to a separate file
chunks.forEach((chunk, index) => {
  const fileName = `brands-${index.toString().padStart(3, '0')}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(chunk, null, 0));
  console.log(`  ✓ Created ${fileName} (${chunk.length} brands, ${(fs.statSync(filePath).size / 1024).toFixed(0)}KB)`);
});

// Create an index file that lists all chunk files
const indexFile = {
  totalBrands: allBrands.length,
  chunksCount: chunks.length,
  brandsPerChunk: BRANDS_PER_FILE,
  chunks: chunks.map((_, index) => `brands-${index.toString().padStart(3, '0')}.json`)
};

const indexPath = path.join(OUTPUT_DIR, 'brands-index.json');
fs.writeFileSync(indexPath, JSON.stringify(indexFile, null, 2));
console.log(`✓ Created brands-index.json`);

// Remove the old single brands.json file
const oldBrandsPath = path.join(OUTPUT_DIR, 'brands.json');
if (fs.existsSync(oldBrandsPath)) {
  fs.unlinkSync(oldBrandsPath);
  console.log('✓ Removed old brands.json');
}

console.log('\n✅ Done! Brands split successfully.');
console.log(`📊 Total: ${allBrands.length} brands in ${chunks.length} files`);
