import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { usePreferencesStore } from '../src/stores/usePreferencesStore';
import { useUserStore } from '../src/stores/useUserStore';

export default function RootRedirect() {
  const { firstName, hasSeenWelcome } = usePreferencesStore();
  const { authReady, isAuthenticated } = useUserStore();
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  useEffect(() => {
    if (usePreferencesStore.persist.hasHydrated()) {
      setPrefsHydrated(true);
    } else {
      const unsub = usePreferencesStore.persist.onFinishHydration(() => setPrefsHydrated(true));
      return () => unsub?.();
    }
  }, []);

  if (!prefsHydrated || !authReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  if (!firstName.trim()) {
    return <Redirect href="/onboarding" />;
  }

  if (!hasSeenWelcome) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/welcome-daily" />;
}
