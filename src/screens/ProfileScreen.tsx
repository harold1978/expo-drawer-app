import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { RootDrawerRouteProp, RootDrawerNavigationProp } from '../navigation/types';

export const ProfileScreen: React.FC = () => {
  const route = useRoute<RootDrawerRouteProp<'Profile'>>();
  const navigation = useNavigation<RootDrawerNavigationProp<'Profile'>>();
  const userId = route.params?.userId || 'usr_guest';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.name}>Juan Pérez</Text>
        <Text style={styles.email}>juan.perez@ejemplo.com</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ID: {userId}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.openDrawer()}
        >
          <Ionicons name="menu" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Abrir Drawer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  badgeText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: COLORS.border,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
