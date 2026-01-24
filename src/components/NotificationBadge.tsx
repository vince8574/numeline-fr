import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../theme/themeContext';

type NotificationBadgeProps = {
  label: string;
  count?: number;
};

export function NotificationBadge({ label, count }: NotificationBadgeProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>
      {typeof count === 'number' && count > 0 && (
        <View style={[styles.countContainer, { backgroundColor: colors.accent }]}>
          <Text style={[styles.countText, { color: colors.surface }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start'
  },
  label: {
    fontWeight: '600',
    fontSize: 14
  },
  countContainer: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  countText: {
    fontWeight: '700',
    fontSize: 12
  }
});
