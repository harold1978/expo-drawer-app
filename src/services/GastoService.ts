import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Gasto,
  NuevoGastoInput,
  gastoToFirestore,
  gastoFromFirestore,
} from '../models/Gasto';

export interface IResumenCategoria {
  tipoGastoNombre: string;
  totalInvertido: number;
  porcentaje: number;
  cantidadCompras: number;
}

const coleccionGastosRef = collection(db, 'gastos');

/**
 * Registra un gasto financiero e incrementa automáticamente el totalGastos de la camada.
 */
export const crearGasto = async (gasto: NuevoGastoInput): Promise<string> => {
  if (!gasto.camadaId?.trim()) {
    throw new Error('Debes seleccionar una camada para registrar el gasto.');
  }
  if (!gasto.tipoGastoId?.trim()) {
    throw new Error('Debes seleccionar un tipo de gasto válido.');
  }

  const precio = Number(gasto.precio);
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error('El monto del gasto debe ser mayor a cero.');
  }

  const tipoGastoDoc = await getDoc(doc(db, 'tipos_gasto', gasto.tipoGastoId));
  if (!tipoGastoDoc.exists()) {
    throw new Error(
      'El tipo de gasto seleccionado ya no existe. Actualiza la lista e inténtalo de nuevo.',
    );
  }

  const tipoGastoNombre = String(tipoGastoDoc.data().nombre || '').trim();
  const batch = writeBatch(db);

  // 1. Crear documento en la colección 'gastos'
  const nuevoGastoDoc = doc(coleccionGastosRef);
  batch.set(nuevoGastoDoc, {
    ...gastoToFirestore(gasto),
    tipoGastoNombre,
    createdAt: serverTimestamp(),
  });

  // 2. Incrementar atómicamente el campo 'totalGastos' en la camada correspondiente
  const camadaDoc = doc(db, 'camadas', gasto.camadaId);
  batch.update(camadaDoc, {
    totalGastos: increment(Number(gasto.precio) || 0),
  });

  await batch.commit();
  return nuevoGastoDoc.id;
};

/**
 * Obtiene todos los gastos pertenecientes a una camada específica.
 */
export const obtenerGastosPorCamada = async (
  camadaId: string,
): Promise<Gasto[]> => {
  const q = query(coleccionGastosRef, where('camadaId', '==', camadaId));
  const snapshot = await getDocs(q);
  const gastos = snapshot.docs.map((d) => gastoFromFirestore(d.id, d.data()));
  // Ordenar por fecha descendente
  return gastos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
};

/**
 * Obtiene todos los gastos registrados con un proveedor determinado.
 */
export const obtenerGastosPorProveedor = async (
  proveedor: string,
): Promise<Gasto[]> => {
  const q = query(coleccionGastosRef, where('proveedor', '==', proveedor));
  const snapshot = await getDocs(q);
  const gastos = snapshot.docs.map((d) => gastoFromFirestore(d.id, d.data()));
  return gastos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
};

/**
 * Elimina un gasto y descuenta atómicamente su valor del totalGastos de la camada.
 */
export const eliminarGasto = async (
  gastoId: string,
  camadaId: string,
  precio: number,
): Promise<void> => {
  const batch = writeBatch(db);

  // 1. Borrar documento del gasto
  const gastoDoc = doc(db, 'gastos', gastoId);
  batch.delete(gastoDoc);

  // 2. Descontar valor de la camada
  const camadaDoc = doc(db, 'camadas', camadaId);
  batch.update(camadaDoc, {
    totalGastos: increment(-Math.abs(Number(precio) || 0)),
  });

  await batch.commit();
};

/**
 * Agrupa los gastos de una camada por categoría/tipo y calcula porcentajes.
 */
export const obtenerResumenGastosPorCategoria = async (
  camadaId: string,
): Promise<IResumenCategoria[]> => {
  const gastos = await obtenerGastosPorCamada(camadaId);
  if (gastos.length === 0) return [];

  const agrupado: Record<string, { total: number; count: number }> = {};
  let totalGeneral = 0;

  gastos.forEach((g) => {
    const categoria = g.tipoGastoNombre || 'Otros';
    if (!agrupado[categoria]) {
      agrupado[categoria] = { total: 0, count: 0 };
    }
    agrupado[categoria].total += g.precio;
    agrupado[categoria].count += 1;
    totalGeneral += g.precio;
  });

  return Object.entries(agrupado)
    .map(([categoria, info]) => ({
      tipoGastoNombre: categoria,
      totalInvertido: Number(info.total.toFixed(2)),
      cantidadCompras: info.count,
      porcentaje:
        totalGeneral > 0
          ? Number(((info.total / totalGeneral) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.totalInvertido - a.totalInvertido);
};

/**
 * Objeto agrupador para compatibilidad de importación estilo servicio.
 */
export const GastoService = {
  crear: crearGasto,
  obtenerPorCamada: obtenerGastosPorCamada,
  obtenerPorProveedor: obtenerGastosPorProveedor,
  eliminar: eliminarGasto,
  obtenerResumenPorCategoria: obtenerResumenGastosPorCategoria,
};
