import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  runTransaction,
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

export const obtenerTodosLosGastos = async (): Promise<Gasto[]> => {
  const snapshot = await getDocs(coleccionGastosRef);
  const gastos = snapshot.docs.map((documento) =>
    gastoFromFirestore(documento.id, documento.data()),
  );
  return gastos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
};

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

export const actualizarGasto = async (
  gastoId: string,
  gastoActualizado: NuevoGastoInput,
): Promise<void> => {
  if (!gastoActualizado.camadaId?.trim()) {
    throw new Error('Debes seleccionar una camada para el gasto.');
  }
  if (!gastoActualizado.tipoGastoId?.trim()) {
    throw new Error('Debes seleccionar un tipo de gasto válido.');
  }

  const precioNuevo = Number(gastoActualizado.precio);
  if (!Number.isFinite(precioNuevo) || precioNuevo <= 0) {
    throw new Error('El monto del gasto debe ser mayor a cero.');
  }
  if (!gastoActualizado.proveedor.trim()) {
    throw new Error('El proveedor no puede estar vacío.');
  }
  if (
    !(gastoActualizado.fecha instanceof Date) ||
    Number.isNaN(gastoActualizado.fecha.getTime())
  ) {
    throw new Error('La fecha del gasto no es válida.');
  }

  await runTransaction(db, async (transaction) => {
    const gastoDoc = doc(db, 'gastos', gastoId);
    const gastoSnapshot = await transaction.get(gastoDoc);
    if (!gastoSnapshot.exists())
      throw new Error('El gasto ya no existe. Actualiza la lista.');

    const gastoAnterior = gastoSnapshot.data();
    const camadaAnteriorId = String(gastoAnterior.camadaId || '').trim();
    if (!camadaAnteriorId)
      throw new Error('El gasto no tiene una camada asociada.');

    const tipoGastoDoc = doc(db, 'tipos_gasto', gastoActualizado.tipoGastoId);
    const camadaNuevaDoc = doc(db, 'camadas', gastoActualizado.camadaId);
    const [tipoGastoSnapshot, camadaNuevaSnapshot] = await Promise.all([
      transaction.get(tipoGastoDoc),
      transaction.get(camadaNuevaDoc),
    ]);
    if (!tipoGastoSnapshot.exists())
      throw new Error('El tipo de gasto seleccionado ya no existe.');
    if (!camadaNuevaSnapshot.exists())
      throw new Error('La camada seleccionada ya no existe.');

    const camadaAnteriorDoc = doc(db, 'camadas', camadaAnteriorId);
    const camadaAnteriorSnapshot =
      camadaAnteriorId === gastoActualizado.camadaId
        ? camadaNuevaSnapshot
        : await transaction.get(camadaAnteriorDoc);
    if (!camadaAnteriorSnapshot.exists())
      throw new Error('La camada anterior asociada al gasto ya no existe.');

    const precioAnterior = Number(gastoAnterior.precio) || 0;
    const tipoGastoNombre = String(
      tipoGastoSnapshot.data().nombre || '',
    ).trim();

    transaction.update(gastoDoc, {
      ...gastoToFirestore({
        ...gastoActualizado,
        proveedor: gastoActualizado.proveedor.trim(),
        tipoGastoNombre,
      }),
    });

    if (camadaAnteriorId === gastoActualizado.camadaId) {
      transaction.update(camadaNuevaDoc, {
        totalGastos: increment(precioNuevo - precioAnterior),
      });
    } else {
      transaction.update(camadaAnteriorDoc, {
        totalGastos: increment(-Math.abs(precioAnterior)),
      });
      transaction.update(camadaNuevaDoc, {
        totalGastos: increment(precioNuevo),
      });
    }
  });
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
export const eliminarGasto = async (gastoId: string): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const gastoDoc = doc(db, 'gastos', gastoId);
    const gastoSnapshot = await transaction.get(gastoDoc);

    if (!gastoSnapshot.exists()) return;

    const gasto = gastoSnapshot.data();
    const camadaId = String(gasto.camadaId || '').trim();
    if (!camadaId) {
      throw new Error(
        'El gasto no tiene una camada asociada y no puede eliminarse.',
      );
    }

    const camadaDoc = doc(db, 'camadas', camadaId);
    const camadaSnapshot = await transaction.get(camadaDoc);
    if (!camadaSnapshot.exists()) {
      throw new Error('La camada asociada al gasto ya no existe.');
    }

    const precio = Number(gasto.precio);
    transaction.delete(gastoDoc);
    transaction.update(camadaDoc, {
      totalGastos: increment(-Math.abs(Number.isFinite(precio) ? precio : 0)),
    });
  });
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
  actualizar: actualizarGasto,
  obtenerTodos: obtenerTodosLosGastos,
  obtenerPorCamada: obtenerGastosPorCamada,
  obtenerPorProveedor: obtenerGastosPorProveedor,
  eliminar: eliminarGasto,
  obtenerResumenPorCategoria: obtenerResumenGastosPorCategoria,
};
