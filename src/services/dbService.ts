import { openDatabaseSync } from 'expo-sqlite';
import { useEffect } from 'react';
import { ScannedProduct } from '../types';
import { DEFAULT_BRAND_NAME } from '../constants/defaults';

const DB_NAME = 'numelinefr.db';
const TABLE = 'scans';

const database = openDatabaseSync(DB_NAME);

function ensureSchema() {
  try {
    database.execSync(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        brand TEXT NOT NULL,
        lotNumber TEXT NOT NULL,
        scannedAt INTEGER NOT NULL,
        recallStatus TEXT NOT NULL,
        recallReference TEXT,
        lastCheckedAt INTEGER
      );`
    );
  } catch (error) {
    console.warn('Failed to create database table', error);
  }
}

function migrateLegacySchema() {
  try {
    const legacyColumns = ['photoUri', 'lotPhotoUri', 'productName', 'barcode', 'country'];
    const columns =
      database.getAllSync<{ name: string }>(`PRAGMA table_info(${TABLE});`) ?? [];
    const hasLegacyColumns = columns.some((column) => legacyColumns.includes(column.name));

    if (!hasLegacyColumns) {
      return;
    }

    const tempTable = `${TABLE}_v2`;

    database.execSync(
      `CREATE TABLE IF NOT EXISTS ${tempTable} (
        id TEXT PRIMARY KEY NOT NULL,
        brand TEXT NOT NULL,
        lotNumber TEXT NOT NULL,
        scannedAt INTEGER NOT NULL,
        recallStatus TEXT NOT NULL,
        recallReference TEXT,
        lastCheckedAt INTEGER
      );`
    );

    database.execSync(
      `INSERT INTO ${tempTable} (
        id,
        brand,
        lotNumber,
        scannedAt,
        recallStatus,
        recallReference,
        lastCheckedAt
      )
      SELECT
        id,
        COALESCE(NULLIF(TRIM(brand), ''), '${DEFAULT_BRAND_NAME}'),
        lotNumber,
        COALESCE(scannedAt, strftime('%s','now') * 1000),
        COALESCE(recallStatus, 'unknown'),
        recallReference,
        lastCheckedAt
      FROM ${TABLE};`
    );

    database.execSync(`DROP TABLE ${TABLE};`);
    database.execSync(`ALTER TABLE ${tempTable} RENAME TO ${TABLE};`);
  } catch (error) {
    console.warn('Failed to migrate database schema', error);
  }
}

ensureSchema();
migrateLegacySchema();

type NullableScannedProduct = Omit<
  ScannedProduct,
  'brand' | 'lotNumber' | 'scannedAt' | 'recallStatus'
> & {
  brand: string | null;
  lotNumber: string | null;
  scannedAt: number | null;
  recallStatus: ScannedProduct['recallStatus'] | null;
  recallReference: string | null;
  lastCheckedAt: number | null;
};

function normalizeProduct(row: NullableScannedProduct): ScannedProduct {
  return {
    ...row,
    brand: row.brand ?? DEFAULT_BRAND_NAME,
    lotNumber: row.lotNumber ?? '',
    scannedAt: row.scannedAt ?? Date.now(),
    recallStatus: row.recallStatus ?? 'unknown',
    recallReference: row.recallReference ?? undefined,
    lastCheckedAt: row.lastCheckedAt ?? undefined
  };
}

async function getAll(): Promise<ScannedProduct[]> {
  const rows = database.getAllSync<NullableScannedProduct>(
    `SELECT * FROM ${TABLE} ORDER BY scannedAt DESC`
  );
  return rows.map(normalizeProduct);
}

async function getById(id: string): Promise<ScannedProduct | null> {
  const row = database.getFirstSync<NullableScannedProduct>(
    `SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`,
    [id]
  );
  return row ? normalizeProduct(row) : null;
}

async function insert(product: ScannedProduct) {
  database.runSync(
    `INSERT OR REPLACE INTO ${TABLE} (
      id,
      brand,
      lotNumber,
      scannedAt,
      recallStatus,
      recallReference,
      lastCheckedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.brand,
      product.lotNumber,
      product.scannedAt,
      product.recallStatus,
      product.recallReference ?? null,
      product.lastCheckedAt ?? null
    ]
  );
}

async function update(id: string, payload: Partial<ScannedProduct>) {
  const current = await getById(id);
  if (!current) {
    throw new Error('Cannot update missing product');
  }
  const merged: ScannedProduct = { ...current, ...payload };
  await insert(merged);
}

async function remove(id: string) {
  database.runSync(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
}

async function removeMany(ids: string[]) {
  if (ids.length === 0) {
    return;
  }
  const placeholders = ids.map(() => '?').join(',');
  database.runSync(`DELETE FROM ${TABLE} WHERE id IN (${placeholders})`, ids);
}

export const db = {
  getAll,
  getById,
  insert,
  update,
  remove,
  removeMany
};

export function useDatabaseWarmup() {
  useEffect(() => {
    try {
      database.execSync('PRAGMA journal_mode = WAL;');
    } catch (error) {
      console.warn('Failed to configure database', error);
    }
  }, []);
}
