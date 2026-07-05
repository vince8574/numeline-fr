import AsyncStorage from '@react-native-async-storage/async-storage';
import { db as sqliteDb } from './dbService';
import { setProduct, getAllProducts as getFirestoreProducts } from './firebaseProductsService';

// Migration one-time SQLite -> Firestore (aligné US). Avant, l'historique FR vivait
// UNIQUEMENT en local (SQLite). En passant à Firestore comme source de vérité, on
// migre l'existant au premier lancement après mise à jour pour ne rien perdre.

const MIGRATION_KEY = 'products_migrated_to_firestore';

export async function isMigrationComplete(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_KEY)) === 'true';
  } catch (error) {
    console.error('[ProductMigration] Failed to check migration status:', error);
    return false;
  }
}

async function markMigrationComplete(): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_KEY, 'true');
}

export async function migrateLocalScansToFirestore(): Promise<{
  success: boolean;
  migrated: number;
  skipped: number;
  error?: string;
}> {
  try {
    if (await isMigrationComplete()) {
      return { success: true, migrated: 0, skipped: 0 };
    }

    const sqliteProducts = await sqliteDb.getAll();
    if (sqliteProducts.length === 0) {
      await markMigrationComplete();
      return { success: true, migrated: 0, skipped: 0 };
    }

    // Évite les doublons si la migration a partiellement tourné.
    const firestoreProducts = await getFirestoreProducts();
    const existingIds = new Set(firestoreProducts.map((p) => p.id));

    let migrated = 0;
    let skipped = 0;

    for (const product of sqliteProducts) {
      try {
        if (existingIds.has(product.id)) {
          skipped++;
          continue;
        }
        // On PRÉSERVE id, scannedAt, recallStatus, recallReference (setProduct) :
        // addProduct forçait un id neuf + 'unknown' + date du jour → l'historique
        // migré perdait son statut de rappel et sa date d'origine.
        await setProduct(product);
        migrated++;
      } catch (error) {
        console.error(`[ProductMigration] Failed to migrate product ${product.id}:`, error);
        // On continue : un échec unitaire ne bloque pas la migration.
      }
    }

    await markMigrationComplete();
    console.log(`[ProductMigration] Done: ${migrated} migrated, ${skipped} skipped`);
    return { success: true, migrated, skipped };
  } catch (error) {
    console.error('[ProductMigration] Migration failed:', error);
    return {
      success: false,
      migrated: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function resetMigration(): Promise<void> {
  await AsyncStorage.removeItem(MIGRATION_KEY);
}
