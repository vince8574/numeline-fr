import { Platform } from 'react-native';
import { firebase } from '@react-native-firebase/app-check';

let initPromise: Promise<void> | null = null;

async function initialize(): Promise<void> {
  const provider = firebase.appCheck().newReactNativeFirebaseAppCheckProvider();
  provider.configure({
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity'
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'deviceCheck'
    }
  });

  await firebase.appCheck().initializeAppCheck({
    provider,
    isTokenAutoRefreshEnabled: true
  });

  const providerName = __DEV__
    ? 'debug'
    : Platform.OS === 'android'
      ? 'playIntegrity'
      : 'deviceCheck';
  console.log(`[AppCheck] initialized (provider: ${providerName})`);

  // In dev the SDK prints the debug token on first getToken() — register it
  // in the Firebase console (App Check → Apps → Manage debug tokens).
  if (__DEV__) {
    try {
      await firebase.appCheck().getToken(true);
    } catch (error) {
      console.log(
        '[AppCheck] DEV: getToken failed — copy the debug token from the device logs and register it in the Firebase console.',
        error
      );
    }
  }
}

export function ensureAppCheck(): Promise<void> {
  if (!initPromise) {
    initPromise = initialize().catch((error) => {
      console.warn('[AppCheck] initialization failed', error);
      // Reset so a later call can retry.
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

// Returns the App Check token to attach as `X-Firebase-AppCheck` header.
// Returns null on failure so callers can decide whether to send the request
// without a token (server-side enforcement decides whether to accept it).
export async function getAppCheckToken(): Promise<string | null> {
  try {
    await ensureAppCheck();
    const result = await firebase.appCheck().getToken();
    return result.token || null;
  } catch (error) {
    console.warn('[AppCheck] Failed to get token', error);
    return null;
  }
}
