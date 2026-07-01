import firestore from '@react-native-firebase/firestore';
import { nanoid } from 'nanoid/non-secure';
import { getCurrentUser } from './authService';
import { ScannedProduct } from '../types';

// Historique des scans stocké sur Firestore (source de vérité), aligné sur la
// version US : collection scannedProducts/{uid}/products. L'app FR exige un compte
// connecté (redirection /auth/login), donc un uid est toujours disponible au scan.
// Objectif : synchro multi-appareils + détection de rappels côté serveur +
// notifications push. Le SQLite local ne sert plus qu'à la migration one-time
// (productMigrationService) et un miroir AsyncStorage alimente la tâche de fond.

const PRODUCTS_COLLECTION = 'scannedProducts';

// Marché de l'app. Le projet Firebase `eatsok-6d19f` est PARTAGÉ avec l'app US :
// les scans FR et US cohabitent dans scannedProducts. Ce marqueur permet à la
// Cloud Function FR (europe-west1, RappelConso) de ne matcher QUE les comptes FR
// (where market == 'FR'), et à l'US (FDA/USDA) de faire l'inverse — sans
// contamination croisée.
const MARKET = 'FR' as const;

// Firestore REFUSE les valeurs `undefined` (.set/.update throw). On retire les
// clés undefined avant écriture (ex. recallReference quand pas de rappel).
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

function currentUid(): string | null {
  return getCurrentUser()?.uid ?? null;
}

function requireUid(): string {
  const uid = currentUid();
  if (!uid) throw new Error('User not authenticated');
  return uid;
}

function productsRef(uid: string) {
  return firestore().collection(PRODUCTS_COLLECTION).doc(uid).collection('products');
}

export async function getAllProducts(): Promise<ScannedProduct[]> {
  const uid = currentUid();
  if (!uid) return [];
  const snapshot = await productsRef(uid).orderBy('scannedAt', 'desc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ScannedProduct[];
}

export async function getProductById(productId: string): Promise<ScannedProduct | null> {
  const uid = currentUid();
  if (!uid) return null;
  const doc = await productsRef(uid).doc(productId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ScannedProduct;
}

export async function addProduct(
  payload: Omit<ScannedProduct, 'id' | 'scannedAt' | 'recallStatus'>
): Promise<ScannedProduct> {
  const uid = requireUid();
  const product: ScannedProduct & { scannedBy?: string } = {
    ...payload,
    id: nanoid(),
    scannedAt: Date.now(),
    recallStatus: 'unknown',
    scannedBy: uid
  };
  // `market` : lu par la Cloud Function FR pour ne traiter que les scans FR.
  await productsRef(uid).doc(product.id).set(stripUndefined({ ...product, market: MARKET }));
  return product;
}

export async function updateProduct(
  productId: string,
  updates: Partial<ScannedProduct>
): Promise<void> {
  const uid = requireUid();
  await productsRef(uid)
    .doc(productId)
    .update(stripUndefined(updates as Record<string, unknown>));
}

export async function removeProduct(productId: string): Promise<void> {
  const uid = requireUid();
  await productsRef(uid).doc(productId).delete();
}

export async function removeProducts(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const uid = requireUid();
  const batch = firestore().batch();
  productIds.forEach((id) => batch.delete(productsRef(uid).doc(id)));
  await batch.commit();
}

// Rétention d'historique : supprime les scans antérieurs à `cutoffTimestamp`.
export async function removeProductsOlderThan(cutoffTimestamp: number): Promise<number> {
  const uid = currentUid();
  if (!uid) return 0;
  const snapshot = await productsRef(uid).where('scannedAt', '<', cutoffTimestamp).get();
  if (snapshot.empty) return 0;
  const batch = firestore().batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

// Écoute temps réel (synchro multi-appareils + rafraîchissement live de l'historique).
export function subscribeToProducts(
  callback: (products: ScannedProduct[]) => void
): () => void {
  const uid = currentUid();
  if (!uid) return () => {};
  return productsRef(uid)
    .orderBy('scannedAt', 'desc')
    .onSnapshot(
      (snapshot) => {
        const products = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as ScannedProduct[];
        callback(products);
      },
      (error) => {
        console.error('[firebaseProductsService] Subscription error:', error);
      }
    );
}
