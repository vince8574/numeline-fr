import firestore from '@react-native-firebase/firestore';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Enregistre le jeton push NATIF de l'appareil (jeton FCM sur Android) sur le doc
// users/{uid}, avec le marqueur de marché. La Cloud Function FR de détection de
// rappels lit ce jeton pour notifier le propriétaire d'un scan rappelé, même app
// fermée. Écrit aussi `market:'FR'` sur le user (projet Firebase partagé FR/US).

const isExpoGo = Constants.appOwnership === 'expo';

export async function registerRecallPushToken(uid: string): Promise<void> {
  try {
    // Toujours taguer le marché du compte (sert au filtrage serveur FR/US),
    // même si le jeton push n'est pas récupérable.
    const userDoc = firestore().collection('users').doc(uid);
    await userDoc.set({ market: 'FR' }, { merge: true });

    if (isExpoGo || !Device.isDevice) return;

    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = typeof data === 'string' ? data : null;
    if (!token) return;

    await userDoc.set(
      {
        pushToken: token,
        pushPlatform: Platform.OS,
        pushTokenUpdatedAt: Date.now()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[pushToken] registerRecallPushToken failed:', error);
  }
}
