import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  TipoGasto,
  CATALOGO_BASE_TIPO_GASTO,
  tipoGastoFromFirestore,
  tipoGastoToFirestore,
} from '../models/TipoGasto';

const coleccionTiposRef = collection(db, 'tipos_gasto');

export class TipoGastoEnUsoError extends Error {
  constructor(cantidadGastos: number) {
    super(
      `No se puede eliminar este tipo porque está asociado a ${cantidadGastos} ${cantidadGastos === 1 ? 'gasto' : 'gastos'}.`,
    );
    this.name = 'TipoGastoEnUsoError';
  }
}

/**
 * Obtiene todos los tipos de gasto registrados, ordenados alfabéticamente.
 */
export const obtenerTiposGasto = async (): Promise<TipoGasto[]> => {
  const q = query(coleccionTiposRef, orderBy('nombre', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => tipoGastoFromFirestore(d.id, d.data()));
};

/**
 * Registra un nuevo tipo de gasto.
 */
export const crearTipoGasto = async (nombre: string): Promise<string> => {
  const docRef = await addDoc(coleccionTiposRef, {
    ...tipoGastoToFirestore({ nombre }),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Actualiza el nombre de un tipo de gasto existente.
 */
export const actualizarTipoGasto = async (
  id: string,
  nombre: string,
): Promise<void> => {
  const docRef = doc(db, 'tipos_gasto', id);
  await updateDoc(docRef, { nombre: nombre.trim() });
};

/**
 * Elimina un tipo de gasto por su ID.
 */
export const eliminarTipoGasto = async (id: string): Promise<void> => {
  const gastosRef = collection(db, 'gastos');
  const gastosAsociados = query(gastosRef, where('tipoGastoId', '==', id));
  const snapshot = await getDocs(gastosAsociados);

  if (!snapshot.empty) {
    throw new TipoGastoEnUsoError(snapshot.size);
  }

  const docRef = doc(db, 'tipos_gasto', id);
  await deleteDoc(docRef);
};

/**
 * Inicializa las categorías base (Alimento inicio, Alimentos desarrollo, etc.)
 * si la colección está vacía.
 */
export const inicializarCatalogoTipoGastoSiVacio = async (): Promise<void> => {
  const snapshot = await getDocs(coleccionTiposRef);
  if (snapshot.empty) {
    for (const nombre of CATALOGO_BASE_TIPO_GASTO) {
      await crearTipoGasto(nombre);
    }
  }
};

/**
 * Objeto agrupador para compatibilidad de importación estilo servicio.
 */
export const TipoGastoService = {
  obtenerTodos: obtenerTiposGasto,
  crear: crearTipoGasto,
  actualizar: actualizarTipoGasto,
  eliminar: eliminarTipoGasto,
  inicializarCatalogoSiVacio: inicializarCatalogoTipoGastoSiVacio,
};
