import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

/**
 * Configuración de Firebase para el proyecto.
 * Reemplaza los valores con las credenciales de tu consola de Firebase:
 * https://console.firebase.google.com/
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyA_CtEojYQ8SHAYCetwFO_P8_H1uHbcqw8",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "pollito2026v2.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "pollito2026v2",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "pollito2026v2.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "394757653153",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:394757653153:web:b47403e4e9f313b5fbe6e0"
};

// Evita inicializar múltiples instancias en Fast Refresh / Hot Reloading
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Firestore: compatible con Web y React Native (Android).
 * getFirestore() usa automáticamente el transporte correcto por plataforma.
 */
const db: Firestore = getFirestore(app);

export { app, db, firebaseConfig };
