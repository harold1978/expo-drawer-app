import { DocumentData } from 'firebase/firestore';

/**
 * Interfaz que representa un Tipo o Categoría de Gasto.
 */
export interface TipoGasto {
  id?: string;
  nombre: string;
}

/**
 * Catálogo base predeterminado según especificación del sistema.
 */
export const CATALOGO_BASE_TIPO_GASTO: string[] = [
  'Alimento inicio',
  'Alimentos desarrollo',
  'Alimento engorde',
  'Desparasitación',
];

/**
 * Convierte un TipoGasto a un objeto plano para Firestore.
 */
export const tipoGastoToFirestore = (tipo: Pick<TipoGasto, 'nombre'>): { nombre: string } => {
  return {
    nombre: tipo.nombre.trim(),
  };
};

/**
 * Convierte un documento de Firestore a la interfaz TipoGasto.
 */
export const tipoGastoFromFirestore = (id: string, data: DocumentData): TipoGasto => {
  return {
    id,
    nombre: data.nombre || '',
  };
};
