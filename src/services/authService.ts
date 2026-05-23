import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Web Client ID from Firebase Console → Project Settings → Your apps → Web app
// Required for Google Sign In on both platforms
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export type AuthProvider = 'google' | 'apple' | 'email';

export type AuthError =
  | 'cancelled'
  | 'network'
  | 'email-in-use'
  | 'wrong-password'
  | 'user-not-found'
  | 'weak-password'
  | 'unknown';

export class AuthServiceError extends Error {
  constructor(
    public readonly code: AuthError,
    message: string
  ) {
    super(message);
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

export function initGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export function onAuthStateChanged(
  callback: (user: FirebaseAuthTypes.User | null) => void
): () => void {
  return auth().onAuthStateChanged(callback);
}

export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

// ─── Google Sign In ──────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<FirebaseAuthTypes.UserCredential> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    const idToken = result.data?.idToken;
    if (!idToken) throw new Error('no idToken');
    const credential = auth.GoogleAuthProvider.credential(idToken);
    return auth().signInWithCredential(credential);
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new AuthServiceError('cancelled', 'Google Sign In annulé');
    }
    if (error.code === statusCodes.NETWORK_ERROR) {
      throw new AuthServiceError('network', 'Erreur réseau');
    }
    throw new AuthServiceError('unknown', error.message ?? 'Erreur Google Sign In');
  }
}

// ─── Apple Sign In (iOS only) ─────────────────────────────────────────────────

export async function signInWithApple(): Promise<FirebaseAuthTypes.UserCredential> {
  const rawNonce = generateNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      throw new AuthServiceError('cancelled', 'Apple Sign In annulé');
    }
    throw new AuthServiceError('unknown', error.message ?? 'Erreur Apple Sign In');
  }

  const { identityToken } = appleCredential;
  if (!identityToken) throw new AuthServiceError('unknown', 'Apple Sign In: pas de token');

  // Pass rawNonce to Firebase — Apple sends the hashed version, Firebase verifies
  const credential = auth.AppleAuthProvider.credential(identityToken, rawNonce);
  return auth().signInWithCredential(credential);
}

export function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

// ─── Email / Password ─────────────────────────────────────────────────────────

export async function signInWithEmail(
  email: string,
  password: string
): Promise<FirebaseAuthTypes.UserCredential> {
  try {
    return await auth().signInWithEmailAndPassword(email, password);
  } catch (error: any) {
    throw mapFirebaseAuthError(error);
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseAuthTypes.UserCredential> {
  try {
    const result = await auth().createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName });
    await result.user.sendEmailVerification();
    return result;
  } catch (error: any) {
    throw mapFirebaseAuthError(error);
  }
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    return await auth().sendPasswordResetEmail(email);
  } catch (error: any) {
    throw mapFirebaseAuthError(error);
  }
}

// ─── Sign Out ────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const providerId = auth().currentUser?.providerData[0]?.providerId;
  if (providerId === 'google.com') {
    try { await GoogleSignin.signOut(); } catch {}
  }
  return auth().signOut();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateNonce(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function mapFirebaseAuthError(error: any): AuthServiceError {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return new AuthServiceError('email-in-use', 'Cet email est déjà utilisé');
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return new AuthServiceError('wrong-password', 'Email ou mot de passe incorrect');
    case 'auth/user-not-found':
      return new AuthServiceError('user-not-found', 'Aucun compte avec cet email');
    case 'auth/weak-password':
      return new AuthServiceError('weak-password', 'Mot de passe trop faible (6 caractères min)');
    case 'auth/network-request-failed':
      return new AuthServiceError('network', 'Erreur réseau');
    default:
      return new AuthServiceError('unknown', error.message ?? 'Erreur inconnue');
  }
}
