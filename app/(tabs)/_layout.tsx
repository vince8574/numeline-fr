import { Tabs } from 'expo-router';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/themeContext';
import { useI18n } from '../../src/i18n/I18nContext';

const tabIcons = {
  home: require('../../assets/home.png'),
  scan: require('../../assets/scan.png'),
  history: require('../../assets/history.png'),
  language: require('../../assets/language.png')
};

const renderTabIcon =
  (source: any) =>
  ({ focused }: { focused: boolean }) => (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent'
      }}
    >
      <Image
        source={source}
        style={{
          width: 34,
          height: 34,
          opacity: focused ? 1 : 0.65
        }}
        resizeMode="contain"
      />
    </View>
  );

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          paddingBottom: 14 + insets.bottom,
          paddingTop: 10,
          height: 76 + insets.bottom
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600'
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: t('navigation.home'),
          tabBarIcon: renderTabIcon(tabIcons.home)
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t('navigation.scan'),
          tabBarIcon: renderTabIcon(tabIcons.scan)
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('navigation.history'),
          tabBarIcon: renderTabIcon(tabIcons.history)
        }}
      />
      <Tabs.Screen
        name="language"
        options={{
          title: t('settings.title'),
          tabBarIcon: renderTabIcon(tabIcons.language)
        }}
      />
    </Tabs>
  );
}
