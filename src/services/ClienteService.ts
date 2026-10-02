import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  clienteFromFirestore,
  clienteToFirestore,
  type Cliente,
  type NuevoClienteInput,
} from '../models/Cliente';

const clientesRef = collection(db, 'clientes');

export class ClienteConVentasError extends Error {
  constructor(cantidadVentas: number) {
    super(
      `No se puede eliminar el cliente porque tiene ${cantidadVentas} ventas registradas.`,
    );
    this.name = 'ClienteConVentasError';
  }
}

export const obtenerClientes = async (): Promise<Cliente[]> => {
  const snapshot = await getDocs(query(clientesRef, orderBy('nombre', 'asc')));
  return snapshot.docs.map((documento) =>
    clienteFromFirestore(documento.id, documento.data()),
  );
};

export const crearCliente = async (
  cliente: NuevoClienteInput,
): Promise<string> => {
  const nombre = cliente.nombre.trim();
  if (nombre.length < 2)
    throw new Error('El nombre del cliente debe tener al menos 2 caracteres.');
  const nuevoCliente = await addDoc(clientesRef, {
    ...clienteToFirestore({ ...cliente, nombre }),
    createdAt: serverTimestamp(),
  });
  return nuevoCliente.id;
};

export const actualizarCliente = async (
  id: string,
  cliente: NuevoClienteInput,
): Promise<void> => {
  const nombre = cliente.nombre.trim();
  if (nombre.length < 2)
    throw new Error('El nombre del cliente debe tener al menos 2 caracteres.');
  await updateDoc(
    doc(db, 'clientes', id),
    clienteToFirestore({ ...cliente, nombre }),
  );
};

export const eliminarCliente = async (id: string): Promise<void> => {
  const ventas = await getDocs(
    query(collection(db, 'ventas'), where('clienteId', '==', id)),
  );
  if (!ventas.empty) throw new ClienteConVentasError(ventas.size);
  await deleteDoc(doc(db, 'clientes', id));
};

export const ClienteService = {
  obtenerTodos: obtenerClientes,
  crear: crearCliente,
  actualizar: actualizarCliente,
  eliminar: eliminarCliente,
};
