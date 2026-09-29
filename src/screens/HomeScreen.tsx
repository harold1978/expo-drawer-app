import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { RootDrawerNavigationProp } from '../navigation/types';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootDrawerNavigationProp<'Home'>>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Banner Card */}
      <View style={styles.heroCard}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>React Native Expo</Text>
        </View>
        <Text style={styles.heroTitle}>Navegación con Drawer</Text>
        <Text style={styles.heroSubtitle}>
          Estructura moderna y escalable lista para producción con React Navigation y Expo SDK.
        </Text>

        <TouchableOpacity
          style={styles.openDrawerButton}
          onPress={() => navigation.openDrawer()}
          activeOpacity={0.8}
        >
          <Ionicons name="menu-outline" size={20} color="#FFFFFF" />
          <Text style={styles.openDrawerButtonText}>Abrir Menú Lateral</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Grid */}
      <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Profile', { userId: 'usr_123' })}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="person-outline" size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Mi Perfil</Text>
          <Text style={styles.cardDescription}>Ver y editar información del usuario</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="notifications-outline" size={24} color="#EF4444" />
          </View>
          <Text style={styles.cardTitle}>Notificaciones</Text>
          <Text style={styles.cardDescription}>Centro de avisos y recordatorios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="settings-outline" size={24} color="#10B981" />
          </View>
          <Text style={styles.cardTitle}>Ajustes</Text>
          <Text style={styles.cardDescription}>Preferencias generales de la app</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
    marginBottom: 20,
  },
  openDrawerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
  },
  openDrawerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  grid: {
    gap: 14,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
