import { DocumentData, Timestamp } from 'firebase/firestore';

export interface Cliente {
  id?: string;
  nombre: string;
  telefono: string;
  createdAt?: Date;
}

export type NuevoClienteInput = Pick<Cliente, 'nombre' | 'telefono'>;

export const clienteToFirestore = (
  cliente: NuevoClienteInput,
): Record<string, string> => ({
  nombre: cliente.nombre.trim(),
  telefono: cliente.telefono.trim(),
});

export const clienteFromFirestore = (
  id: string,
  data: DocumentData,
): Cliente => ({
  id,
  nombre: String(data.nombre || ''),
  telefono: String(data.telefono || ''),
  createdAt:
    data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : data.createdAt?.toDate?.() || new Date(),
});
