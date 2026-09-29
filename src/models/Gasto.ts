import { DocumentData, Timestamp } from 'firebase/firestore';

/**
 * Interfaz que representa un Gasto financiero asociado a una Camada y a un Tipo de Gasto.
 */
export interface Gasto {
  id?: string;
  camadaId: string;
  tipoGastoId: string;
  tipoGastoNombre?: string;
  precio: number;
  proveedor: string;
  fecha: Date;
  createdAt?: Date;
}

/**
 * Tipo para registrar un nuevo gasto omitiendo id y createdAt.
 */
export type NuevoGastoInput = Omit<Gasto, 'id' | 'createdAt'>;

// ==========================================
// Serialización y Deserialización Firestore
// ==========================================

export const gastoToFirestore = (gasto: NuevoGastoInput | Partial<Gasto>): Record<string, any> => {
  return {
    camadaId: gasto.camadaId,
    tipoGastoId: gasto.tipoGastoId,
    tipoGastoNombre: gasto.tipoGastoNombre || '',
    precio: Number(gasto.precio) || 0,
    proveedor: gasto.proveedor || '',
    fecha: gasto.fecha ? Timestamp.fromDate(gasto.fecha) : Timestamp.now(),
  };
};

export const gastoFromFirestore = (id: string, data: DocumentData): Gasto => {
  const toDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Timestamp) return val.toDate();
    if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
    if (typeof val === 'string' || typeof val === 'number') return new Date(val);
    return new Date();
  };

  return {
    id,
    camadaId: data.camadaId || '',
    tipoGastoId: data.tipoGastoId || '',
    tipoGastoNombre: data.tipoGastoNombre || '',
    precio: Number(data.precio) || 0,
    proveedor: data.proveedor || '',
    fecha: toDate(data.fecha),
    createdAt: toDate(data.createdAt),
  };
};
