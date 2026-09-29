# 📱 Proyecto React Native Expo con Navegación Drawer

Este proyecto contiene una arquitectura limpia, modular y escalable para una aplicación en **React Native con Expo** implementando navegación por menú lateral (**Drawer Navigation**) mediante `@react-navigation/drawer`.

---

## 📂 Estructura del Proyecto

```text
expo-drawer-app/
├── App.tsx                    # Componente raíz con GestureHandlerRootView y NavigationContainer
├── index.js                   # Punto de entrada (import 'react-native-gesture-handler' en la 1ra línea)
├── app.json                   # Configuración del proyecto Expo
├── babel.config.js            # Configuración de Babel (plugin de reanimated al final)
├── tsconfig.json              # Configuración de TypeScript
├── package.json               # Dependencias del proyecto
│
└── src/
    ├── components/
    │   └── CustomDrawerContent.tsx # Menú lateral personalizado (header con avatar + items + botón cerrar sesión)
    ├── constants/
    │   └── colors.ts          # Paleta de colores centralizada
    ├── navigation/
    │   ├── DrawerNavigator.tsx # Configuración del Drawer y registro de pantallas
    │   └── types.ts           # Tipado TypeScript para rutas y navegación
    └── screens/
        ├── HomeScreen.tsx     # Pantalla Principal con accesos directos
        ├── ProfileScreen.tsx  # Pantalla de Perfil de usuario
        ├── NotificationsScreen.tsx # Pantalla de Notificaciones con badge
        └── SettingsScreen.tsx # Pantalla de Configuración con switches
```

---

## 🚀 Pasos para Instalar y Ejecutar

### 1. Instalar dependencias
Dentro del directorio del proyecto, ejecuta:
```bash
npm install
```

O si estás creando un proyecto nuevo desde cero con Expo CLI:
```bash
npx expo install @react-navigation/native @react-navigation/drawer react-native-gesture-handler react-native-reanimated react-native-screens react-native-safe-area-context @expo/vector-icons
```

### 2. Iniciar el servidor de desarrollo
> [!IMPORTANT]
> Si es la primera vez que configuras `react-native-reanimated`, inicia Expo limpiando la caché con la bandera `-c`:

```bash
npx expo start -c
```

### 3. Probar en dispositivos
- **Expo Go (Android / iOS):** Escanea el código QR desde la app Expo Go.
- **Emulador Android:** Presiona `a` en la terminal.
- **Simulador iOS (macOS):** Presiona `i` en la terminal.
- **Web:** Presiona `w` en la terminal.

---

## ⚠️ Aspectos Críticos a Recordar

1. **`import 'react-native-gesture-handler';`**:
   Debe estar en la **primera línea** del archivo de entrada (`index.js`). Si no está al inicio, los gestos no responderán en Android/iOS.
2. **`react-native-reanimated/plugin` en `babel.config.js`**:
   Debe ubicarse como el **último elemento** en la lista de `plugins`:
   ```javascript
   plugins: [
     'react-native-reanimated/plugin',
   ]
   ```
3. **`GestureHandlerRootView`**:
   El componente raíz (`App.tsx`) debe estar envuelto en `<GestureHandlerRootView style={{ flex: 1 }}>`.
