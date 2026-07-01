import firestore from '@react-native-firebase/firestore';
import type { DietaryProfile } from './dietaryProfile';

// Profil alimentaire stocké sous users/{uid}.dietaryProfile (même doc que la
// souscription et l'historique) : synchronisé multi-appareils et disponible
// côté serveur pour un futur matching rappels/notifications ciblées.

function userDoc(uid: string) {
  return firestore().collection('users').doc(uid);
}

export async function fetchDietaryProfileFromFirestore(
  uid: string
): Promise<DietaryProfile | null> {
  try {
    const snap = await userDoc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data?.dietaryProfile) return null;
    return data.dietaryProfile as DietaryProfile;
  } catch (error) {
    console.warn('[Firestore] fetchDietaryProfile failed:', error);
    return null;
  }
}

export async function saveDietaryProfileToFirestore(
  uid: string,
  profile: Omit<DietaryProfile, 'updatedAt'>
): Promise<void> {
  try {
    await userDoc(uid).set(
      { dietaryProfile: { ...profile, updatedAt: Date.now() } },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Firestore] saveDietaryProfile failed:', error);
  }
}

export function listenToDietaryProfile(
  uid: string,
  onChange: (profile: DietaryProfile | null) => void
): () => void {
  return userDoc(uid).onSnapshot(
    (snap) => {
      const data = snap?.data();
      onChange((data?.dietaryProfile as DietaryProfile) ?? null);
    },
    (error) => {
      console.warn('[Firestore] dietaryProfile listener error:', error);
    }
  );
}
