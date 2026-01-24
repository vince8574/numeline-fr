import { Stack } from 'expo-router';
import { AppProviders } from '../src/providers/AppProviders';
import { AppInitializer } from '../src/providers/AppInitializer';
import '../src/theme/themeContext';
import { useI18n } from '../src/i18n/I18nContext';
import { useCustomFonts } from '../src/hooks/useCustomFonts';
import { View, ActivityIndicator } from 'react-native';

function RootStack() {
  const { t } = useI18n();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="details/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="manual-entry" options={{ presentation: 'modal', title: t('manualEntry.title') }} />
      <Stack.Screen name="scan-lot" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="welcome-daily" options={{ headerShown: false }} />
      <Stack.Screen name="legal/privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
      <Stack.Screen name="legal/legal-notice" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const fontsLoaded = useCustomFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#C4DECC' }}>
        <ActivityIndicator size="large" color="#0BAE86" />
      </View>
    );
  }

  return (
    <AppProviders>
      <AppInitializer />
      <RootStack />
    </AppProviders>
  );
}
