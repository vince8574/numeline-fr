// Service pour gérer les patterns de numéros de lot par marque
import { openDatabaseSync } from 'expo-sqlite';

const DB_NAME = 'numelinefr.db';
const TABLE = 'lot_patterns';

interface LotPattern {
  brand: string;
  pattern: string;
  regex: string;
  exampleLot: string;
  count: number; // Nombre de fois que ce pattern a été vu
  lastSeen: number; // Timestamp de la dernière occurrence
}

const db = openDatabaseSync(DB_NAME);

// Créer la table pour stocker les patterns de lots par marque
function ensureLotPatternSchema() {
  try {
    db.execSync(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL,
        pattern TEXT NOT NULL,
        regex TEXT NOT NULL,
        exampleLot TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        lastSeen INTEGER NOT NULL,
        UNIQUE(brand, pattern)
      );`
    );
    console.log('[LotPattern] Schema initialized');
  } catch (error) {
    console.warn('[LotPattern] Failed to ensure schema:', error);
  }
}

ensureLotPatternSchema();

/**
 * Analyse un numéro de lot et extrait son pattern
 * Ex: "L12345" -> "L#####"
 *     "20231215AB" -> "########XX"
 *     "A12B34" -> "X##X##"
 */
export function analyzeLotPattern(lotNumber: string): { pattern: string; regex: string } {
  let pattern = '';
  let regexPattern = '';

  for (const char of lotNumber) {
    if (/[0-9]/.test(char)) {
      pattern += '#';
      regexPattern += '\\d';
    } else if (/[A-Z]/i.test(char)) {
      pattern += 'X';
      regexPattern += '[A-Z]';
    } else if (/[\/\-\.\s]/.test(char)) {
      pattern += char;
      regexPattern += '\\' + char;
    } else {
      pattern += '?';
      regexPattern += '.';
    }
  }

  return {
    pattern,
    regex: `^${regexPattern}$`
  };
}

/**
 * Enregistre un pattern de lot pour une marque
 */
export async function saveLotPattern(brand: string, lotNumber: string): Promise<void> {
  if (!brand || !lotNumber) return;

  const { pattern, regex } = analyzeLotPattern(lotNumber);

  try {
    // Chercher si ce pattern existe déjà pour cette marque
    const existing = db.getFirstSync<{ count: number }>(
      `SELECT count FROM ${TABLE} WHERE brand = ? AND pattern = ?`,
      [brand, pattern]
    );

    if (existing) {
      // Incrémenter le compteur
      db.runSync(
        `UPDATE ${TABLE} SET count = count + 1, lastSeen = ?, exampleLot = ? WHERE brand = ? AND pattern = ?`,
        [Date.now(), lotNumber, brand, pattern]
      );
      console.log(`[LotPattern] Updated pattern for ${brand}: ${pattern} (count: ${existing.count + 1})`);
    } else {
      // Créer un nouveau pattern
      db.runSync(
        `INSERT INTO ${TABLE} (brand, pattern, regex, exampleLot, count, lastSeen) VALUES (?, ?, ?, ?, 1, ?)`,
        [brand, pattern, regex, lotNumber, Date.now()]
      );
      console.log(`[LotPattern] Saved new pattern for ${brand}: ${pattern}`);
    }
  } catch (error) {
    console.error('[LotPattern] Failed to save pattern:', error);
  }
}

/**
 * Récupère les patterns connus pour une marque (triés par fréquence)
 */
export function getLotPatternsForBrand(brand: string): LotPattern[] {
  if (!brand) return [];

  try {
    const patterns = db.getAllSync<LotPattern>(
      `SELECT * FROM ${TABLE} WHERE brand = ? ORDER BY count DESC, lastSeen DESC`,
      [brand]
    );
    console.log(`[LotPattern] Found ${patterns.length} patterns for ${brand}`);
    return patterns;
  } catch (error) {
    console.error('[LotPattern] Failed to get patterns:', error);
    return [];
  }
}

/**
 * Vérifie si un numéro de lot correspond aux patterns connus d'une marque
 */
export function validateLotAgainstBrandPatterns(
  brand: string,
  lotNumber: string
): { isValid: boolean; matchedPattern?: LotPattern; confidence: number } {
  const patterns = getLotPatternsForBrand(brand);

  if (patterns.length === 0) {
    // Pas de patterns connus, on accepte tout
    return { isValid: true, confidence: 0 };
  }

  // Tester le lot contre chaque pattern connu
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.regex, 'i');
      if (regex.test(lotNumber)) {
        // Calculer la confiance basée sur la fréquence
        const totalCount = patterns.reduce((sum, p) => sum + p.count, 0);
        const confidence = pattern.count / totalCount;

        console.log(
          `✅ Lot "${lotNumber}" matches pattern "${pattern.pattern}" for ${brand} (confidence: ${(confidence * 100).toFixed(0)}%)`
        );

        return {
          isValid: true,
          matchedPattern: pattern,
          confidence
        };
      }
    } catch (error) {
      console.warn('[LotPattern] Invalid regex:', pattern.regex);
    }
  }

  // Le lot ne correspond à aucun pattern connu
  console.log(`⚠️ Lot "${lotNumber}" doesn't match any known pattern for ${brand}`);
  return { isValid: false, confidence: 0 };
}

/**
 * Obtient des statistiques sur les patterns de lots
 */
export function getLotPatternStats(): {
  totalBrands: number;
  totalPatterns: number;
  topBrands: Array<{ brand: string; patternCount: number }>;
} {
  try {
    const totalPatterns = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE}`
    );

    const totalBrands = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(DISTINCT brand) as count FROM ${TABLE}`
    );

    const topBrands = db.getAllSync<{ brand: string; patternCount: number }>(
      `SELECT brand, COUNT(*) as patternCount FROM ${TABLE} GROUP BY brand ORDER BY patternCount DESC LIMIT 10`
    );

    return {
      totalBrands: totalBrands?.count || 0,
      totalPatterns: totalPatterns?.count || 0,
      topBrands
    };
  } catch (error) {
    console.error('[LotPattern] Failed to get stats:', error);
    return { totalBrands: 0, totalPatterns: 0, topBrands: [] };
  }
}
