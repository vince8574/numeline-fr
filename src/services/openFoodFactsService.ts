// Service pour récupérer les informations produit depuis Open Food Facts
export interface ProductInfo {
  barcode: string;
  productName: string;
  brand: string;
  brands: string;
  categories?: string;
  imageUrl?: string;
}

// Open Food Facts API v2. PAS de User-Agent custom : Open Food Facts bloque/limite
// certains User-Agents (l'ancien `numelineFR/1.0.5` → la marque n'était plus
// reconnue sur l'app, alors que la version US, sans UA custom et en v2, fonctionne).
// On tente le domaine FR (noms localisés) puis le domaine mondial en repli, avec un
// timeout de 5 s pour ne pas bloquer le scan si l'API est lente. (Aligné sur le
// service de la version US, plus robuste.)
const OFF_FR_API = 'https://fr.openfoodfacts.org/api/v2';
const OFF_WORLD_API = 'https://world.openfoodfacts.org/api/v2';
const OFF_FIELDS =
  'product_name,product_name_fr,product_name_en,brands,categories,image_url,image_front_url';

function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Récupère les informations d'un produit depuis Open Food Facts
 * @param barcode - Code-barres EAN/GTIN du produit
 * @returns Informations du produit ou null si non trouvé
 */
export async function getProductByBarcode(barcode: string): Promise<ProductInfo | null> {
  const cleanBarcode = barcode.trim();
  try {
    console.log(`[OpenFoodFacts] Fetching product info for barcode: ${cleanBarcode}`);

    // Domaine FR d'abord (noms localisés), repli sur le domaine mondial si indispo.
    let response = await fetchWithTimeout(
      `${OFF_FR_API}/product/${cleanBarcode}.json?fields=${OFF_FIELDS}`
    );
    if (!response.ok) {
      response = await fetchWithTimeout(
        `${OFF_WORLD_API}/product/${cleanBarcode}.json?fields=${OFF_FIELDS}`
      );
    }

    if (!response.ok) {
      console.warn(`[OpenFoodFacts] API returned status ${response.status} for ${cleanBarcode}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 0 || !data.product) {
      console.log(`[OpenFoodFacts] Product not found for barcode: ${barcode}`);
      return null;
    }

    const product = data.product;

    // Extraire la marque principale
    let brand = product.brands || '';

    // Si plusieurs marques sont listées (séparées par des virgules), prendre la première
    if (brand.includes(',')) {
      brand = brand.split(',')[0].trim();
    }

    const productInfo: ProductInfo = {
      barcode,
      productName: product.product_name || product.product_name_fr || product.product_name_en || 'Produit inconnu',
      brand: brand || 'Marque inconnue',
      brands: product.brands || '',
      categories: product.categories,
      imageUrl: product.image_url || product.image_front_url
    };

    console.log(`✅ Product found: ${productInfo.productName} - ${productInfo.brand}`);
    return productInfo;
  } catch (error) {
    console.error('[OpenFoodFacts] Error fetching product:', error);
    return null;
  }
}

/**
 * Valide qu'un code-barres a un format valide (8, 12, 13 ou 14 chiffres)
 */
export function isValidBarcode(barcode: string): boolean {
  const cleanBarcode = barcode.trim();
  return /^\d{8}$|^\d{12,14}$/.test(cleanBarcode);
}
