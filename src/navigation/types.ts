import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { RouteProp } from '@react-navigation/native';

export type RootDrawerParamList = {
  Home: undefined;
  Gastos: undefined;
  TiposGasto: undefined;
  Profile: { userId?: string };
  Notifications: undefined;
  Settings: undefined;
};

export type RootDrawerNavigationProp<T extends keyof RootDrawerParamList> =
  DrawerNavigationProp<RootDrawerParamList, T>;

export type RootDrawerRouteProp<T extends keyof RootDrawerParamList> =
  RouteProp<RootDrawerParamList, T>;
