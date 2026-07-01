import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Enregistre le jeton push FCM sur users/{uid}, avec le marqueur de marché. La
// Cloud Function FR de détection de rappels lit ce jeton pour notifier le
// propriétaire d'un scan rappelé, même app fermée (via admin.messaging().send).
//
// On passe par @react-native-firebase/messaging (et non expo-notifications
// getDevicePushTokenAsync) pour obtenir un vrai jeton FCM CROSS-PLATEFORME :
// sur iOS, getDevicePushTokenAsync renvoyait le jeton APNs brut, que
// admin.messaging().send({ token }) REFUSE. messaging().getToken() renvoie le
// jeton d'enregistrement FCM sur Android ET iOS (APNs relayé par FCM).
//
// Prérequis iOS (côté console, hors code) : clé d'authentification APNs uploadée
// dans Firebase (Project settings > Cloud Messaging). Sans elle, iOS ne délivre pas.

const isExpoGo = Constants.appOwnership === 'expo';

async function getFcmToken(): Promise<string | null> {
  try {
    // iOS : associe le jeton APNs au jeton FCM (no-op/auto sur Android).
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    return token || null;
  } catch (error) {
    console.warn('[pushToken] getFcmToken failed:', error);
    return null;
  }
}

async function saveToken(uid: string, token: string): Promise<void> {
  await firestore()
    .collection('users')
    .doc(uid)
    .set(
      { pushToken: token, pushPlatform: Platform.OS, pushTokenUpdatedAt: Date.now() },
      { merge: true }
    );
}

export async function registerRecallPushToken(uid: string): Promise<void> {
  try {
    // Toujours taguer le marché du compte (filtrage serveur FR/US), même sans jeton.
    await firestore().collection('users').doc(uid).set({ market: 'FR' }, { merge: true });

    if (isExpoGo || !Device.isDevice) return;

    const token = await getFcmToken();
    if (token) await saveToken(uid, token);
  } catch (error) {
    console.warn('[pushToken] registerRecallPushToken failed:', error);
  }
}

// Le jeton FCM peut être renouvelé par le système : on met alors à jour Firestore.
export function listenForTokenRefresh(uid: string): () => void {
  if (isExpoGo) return () => {};
  try {
    return messaging().onTokenRefresh((token) => {
      void saveToken(uid, token).catch((e) =>
        console.warn('[pushToken] refresh save failed:', e)
      );
    });
  } catch {
    return () => {};
  }
}
