import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GastosScreen } from '../screens/GastosScreen';
import { TiposGastoScreen } from '../screens/TiposGastoScreen';
import { CustomDrawerContent } from '../components/CustomDrawerContent';
import { COLORS } from '../constants/colors';
import type { RootDrawerParamList } from './types';

const Drawer = createDrawerNavigator<RootDrawerParamList>();

export const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.card,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: COLORS.textPrimary,
        },
        headerTintColor: COLORS.primary,
        drawerActiveBackgroundColor: COLORS.drawerActiveBackground,
        drawerActiveTintColor: COLORS.drawerActiveTint,
        drawerInactiveTintColor: COLORS.drawerInactiveTint,
        drawerItemStyle: {
          borderRadius: 12,
          marginVertical: 4,
          paddingHorizontal: 8,
        },
        drawerLabelStyle: {
          marginLeft: -10,
          fontSize: 14,
          fontWeight: '600',
        },
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Inicio',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Drawer.Screen
        name="Gastos"
        component={GastosScreen}
        options={{
          title: 'Gastos',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Drawer.Screen
        name="TiposGasto"
        component={TiposGastoScreen}
        options={{
          title: 'Tipos de Gasto',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'pricetag' : 'pricetag-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notificaciones',
          drawerBadge: '3',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Configuración',
          drawerIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};
