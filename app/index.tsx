import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { usePreferencesStore } from '../src/stores/usePreferencesStore';

export default function RootRedirect() {
  const { firstName, hasSeenWelcome } = usePreferencesStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const wasHydrated = usePreferencesStore.persist.hasHydrated();

    if (wasHydrated) {
      setHydrated(true);
    } else {
      const unsub = usePreferencesStore.persist.onFinishHydration(() => setHydrated(true));
      return () => unsub?.();
    }
  }, []);

  // Attendre que les données soient chargées
  if (!hydrated) {
    return null;
  }

  // Déterminer la destination (l'animation sera affichée dans WelcomeScreen)
  let path = '/welcome-daily';

  if (!firstName.trim()) {
    path = '/onboarding';
  } else if (!hasSeenWelcome) {
    path = '/welcome';
  }

  return <Redirect href={path as any} />;
}
