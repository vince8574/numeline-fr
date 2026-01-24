/**
 * Service de gestion des marques personnalisées
 * Permet aux utilisateurs d'ajouter de nouvelles marques qui ne sont pas dans la liste de base
 */

import { openDatabaseSync } from 'expo-sqlite';

const DB_NAME = 'numelinefr.db';
const TABLE = 'custom_brands';

const database = openDatabaseSync(DB_NAME);

export interface CustomBrand {
  id: string;
  name: string;
  addedAt: number;
  usageCount: number; // Nombre de fois utilisée
}

/**
 * Crée la table des marques personnalisées si elle n'existe pas
 */
function ensureSchema() {
  try {
    database.execSync(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        addedAt INTEGER NOT NULL,
        usageCount INTEGER NOT NULL DEFAULT 0
      );`
    );

    // Index pour recherche rapide par nom
    database.execSync(
      `CREATE INDEX IF NOT EXISTS idx_custom_brands_name
       ON ${TABLE}(name COLLATE NOCASE);`
    );
  } catch (error) {
    console.warn('Failed to create custom_brands table', error);
  }
}

// Initialiser le schéma au chargement du module
ensureSchema();

/**
 * Récupère toutes les marques personnalisées
 */
export async function getAllCustomBrands(): Promise<CustomBrand[]> {
  try {
    const rows = database.getAllSync<CustomBrand>(
      `SELECT * FROM ${TABLE} ORDER BY usageCount DESC, name ASC`
    );
    return rows;
  } catch (error) {
    console.warn('Failed to get custom brands', error);
    return [];
  }
}

/**
 * Récupère une marque personnalisée par son nom (case-insensitive)
 */
export async function getCustomBrandByName(name: string): Promise<CustomBrand | null> {
  try {
    const row = database.getFirstSync<CustomBrand>(
      `SELECT * FROM ${TABLE} WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [name.trim()]
    );
    return row || null;
  } catch (error) {
    console.warn('Failed to get custom brand by name', error);
    return null;
  }
}

/**
 * Vérifie si une marque personnalisée existe
 */
export async function customBrandExists(name: string): Promise<boolean> {
  const brand = await getCustomBrandByName(name);
  return brand !== null;
}

/**
 * Ajoute une nouvelle marque personnalisée
 * Retourne false si la marque existe déjà
 */
export async function addCustomBrand(name: string): Promise<boolean> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    console.warn('Cannot add empty brand name');
    return false;
  }

  // Vérifier si la marque existe déjà
  const existing = await getCustomBrandByName(trimmedName);
  if (existing) {
    console.log(`Custom brand "${trimmedName}" already exists`);
    return false;
  }

  try {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    database.runSync(
      `INSERT INTO ${TABLE} (id, name, addedAt, usageCount)
       VALUES (?, ?, ?, ?)`,
      [id, trimmedName, Date.now(), 0]
    );

    console.log(`✓ Custom brand "${trimmedName}" added successfully`);
    return true;
  } catch (error) {
    console.warn('Failed to add custom brand', error);
    return false;
  }
}

/**
 * Incrémente le compteur d'utilisation d'une marque
 */
export async function incrementBrandUsage(name: string): Promise<void> {
  try {
    database.runSync(
      `UPDATE ${TABLE}
       SET usageCount = usageCount + 1
       WHERE LOWER(name) = LOWER(?)`,
      [name.trim()]
    );
  } catch (error) {
    console.warn('Failed to increment brand usage', error);
  }
}

/**
 * Supprime une marque personnalisée
 */
export async function removeCustomBrand(id: string): Promise<void> {
  try {
    database.runSync(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  } catch (error) {
    console.warn('Failed to remove custom brand', error);
  }
}

/**
 * Recherche des marques personnalisées par préfixe
 * Utile pour l'autocomplete
 */
export async function searchCustomBrands(prefix: string, limit = 10): Promise<CustomBrand[]> {
  if (!prefix.trim()) {
    return [];
  }

  try {
    const rows = database.getAllSync<CustomBrand>(
      `SELECT * FROM ${TABLE}
       WHERE name LIKE ? || '%' COLLATE NOCASE
       ORDER BY usageCount DESC, name ASC
       LIMIT ?`,
      [prefix.trim(), limit]
    );
    return rows;
  } catch (error) {
    console.warn('Failed to search custom brands', error);
    return [];
  }
}

/**
 * Nettoie les marques personnalisées jamais utilisées et plus vieilles que X jours
 */
export async function cleanupUnusedBrands(olderThanDays = 90): Promise<number> {
  try {
    const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

    const result = database.runSync(
      `DELETE FROM ${TABLE}
       WHERE usageCount = 0 AND addedAt < ?`,
      [cutoffDate]
    );

    const deletedCount = result.changes;

    if (deletedCount > 0) {
      console.log(`✓ Cleaned up ${deletedCount} unused custom brands`);
    }

    return deletedCount;
  } catch (error) {
    console.warn('Failed to cleanup unused brands', error);
    return 0;
  }
}

/**
 * Exporte toutes les marques personnalisées (pour backup/sync)
 */
export async function exportCustomBrands(): Promise<string[]> {
  const brands = await getAllCustomBrands();
  return brands.map(b => b.name);
}

/**
 * Importe des marques personnalisées (pour backup/sync)
 */
export async function importCustomBrands(brandNames: string[]): Promise<number> {
  let importedCount = 0;

  for (const name of brandNames) {
    const success = await addCustomBrand(name);
    if (success) {
      importedCount++;
    }
  }

  console.log(`✓ Imported ${importedCount}/${brandNames.length} custom brands`);
  return importedCount;
}

export const customBrandsService = {
  getAllCustomBrands,
  getCustomBrandByName,
  customBrandExists,
  addCustomBrand,
  incrementBrandUsage,
  removeCustomBrand,
  searchCustomBrands,
  cleanupUnusedBrands,
  exportCustomBrands,
  importCustomBrands,
};
