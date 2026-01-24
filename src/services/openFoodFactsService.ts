// Service pour récupérer les informations produit depuis Open Food Facts
export interface ProductInfo {
  barcode: string;
  productName: string;
  brand: string;
  brands: string;
  categories?: string;
  imageUrl?: string;
}

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v2';

/**
 * Récupère les informations d'un produit depuis Open Food Facts
 * @param barcode - Code-barres EAN/GTIN du produit
 * @returns Informations du produit ou null si non trouvé
 */
export async function getProductByBarcode(barcode: string): Promise<ProductInfo | null> {
  try {
    console.log(`[OpenFoodFacts] Fetching product info for barcode: ${barcode}`);

    const response = await fetch(`${OPEN_FOOD_FACTS_API}/product/${barcode}.json`);

    if (!response.ok) {
      console.warn(`[OpenFoodFacts] API returned status ${response.status}`);
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
