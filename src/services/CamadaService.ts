import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Camada,
  NuevaCamadaInput,
  camadaToFirestore,
  camadaFromFirestore,
  obtenerPollosVivos,
} from '../models/Camada';

export interface IAlertaCamada {
  camadaId: string;
  camadaNombre: string;
  tipoAlerta: 'Desarrollo' | 'Engorde' | 'Desparasitación';
  fecha: Date;
  diasRestantes: number;
}

export interface IResumenGranja {
  totalCamadasActivas: number;
  totalPollosVivos: number;
  totalMuertes: number;
  totalInversionActiva: number;
  tasaMortalidadGlobalPct: number;
}

const coleccionCamadasRef = collection(db, 'camadas');

export class CamadaConGastosError extends Error {
  constructor(cantidadGastos: number) {
    super(
      `No se puede eliminar la camada porque tiene ${cantidadGastos} ${cantidadGastos === 1 ? 'gasto asociado' : 'gastos asociados'}.`,
    );
    this.name = 'CamadaConGastosError';
  }
}

export class CamadaConVentasError extends Error {
  constructor(cantidadVentas: number) {
    super(
      `No se puede eliminar la camada porque tiene ${cantidadVentas} ${cantidadVentas === 1 ? 'venta registrada' : 'ventas registradas'}.`,
    );
    this.name = 'CamadaConVentasError';
  }
}

/**
 * Crea una nueva camada en Firestore.
 */
export const crearCamada = async (
  camada: NuevaCamadaInput,
): Promise<string> => {
  const docRef = await addDoc(coleccionCamadasRef, {
    ...camadaToFirestore(camada),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Obtiene todas las camadas registradas, ordenadas por fecha de ingreso desc.
 */
export const obtenerTodasLasCamadas = async (): Promise<Camada[]> => {
  const q = query(coleccionCamadasRef, orderBy('fechaIngreso', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => camadaFromFirestore(d.id, d.data()));
};

/**
 * Obtiene únicamente las camadas activas.
 */
export const obtenerCamadasActivas = async (): Promise<Camada[]> => {
  const q = query(coleccionCamadasRef, where('activa', '==', true));
  const snapshot = await getDocs(q);
  const camadas = snapshot.docs.map((d) => camadaFromFirestore(d.id, d.data()));
  // Ordenar en memoria por fechaIngreso descendente
  return camadas.sort(
    (a, b) => b.fechaIngreso.getTime() - a.fechaIngreso.getTime(),
  );
};

/**
 * Obtiene una camada por su ID.
 */
export const obtenerCamadaPorId = async (
  id: string,
): Promise<Camada | null> => {
  const docRef = doc(db, 'camadas', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return camadaFromFirestore(snap.id, snap.data());
};

/**
 * Actualiza datos generales o fechas de una camada.
 */
export const actualizarCamada = async (
  id: string,
  datos: Partial<Camada>,
): Promise<void> => {
  const docRef = doc(db, 'camadas', id);
  const updatePayload: Record<string, any> = {};

  if (datos.nombre !== undefined) updatePayload.nombre = datos.nombre;
  if (datos.cantidadPollos !== undefined)
    updatePayload.cantidadPollos = Number(datos.cantidadPollos);
  if (datos.fechaIngreso !== undefined)
    updatePayload.fechaIngreso = Timestamp.fromDate(datos.fechaIngreso);
  if (datos.fechaCambioAlimentoDesarrollo !== undefined) {
    updatePayload.fechaCambioAlimentoDesarrollo =
      datos.fechaCambioAlimentoDesarrollo
        ? Timestamp.fromDate(datos.fechaCambioAlimentoDesarrollo)
        : null;
  }
  if (datos.fechaCambioAlimentoEngorde !== undefined) {
    updatePayload.fechaCambioAlimentoEngorde = datos.fechaCambioAlimentoEngorde
      ? Timestamp.fromDate(datos.fechaCambioAlimentoEngorde)
      : null;
  }
  if (datos.fechaDesparasitacion !== undefined) {
    updatePayload.fechaDesparasitacion = datos.fechaDesparasitacion
      ? Timestamp.fromDate(datos.fechaDesparasitacion)
      : null;
  }
  if (datos.activa !== undefined) updatePayload.activa = datos.activa;
  if (datos.venta !== undefined) updatePayload.venta = datos.venta;
  if (datos.costoOperacionPorKg !== undefined) {
    updatePayload.costoOperacionPorKg = Number(datos.costoOperacionPorKg) || 0;
  }

  await updateDoc(docRef, updatePayload);
};

/**
 * Registra bajas (muertes) de forma atómica.
 */
export const registrarBajasCamada = async (
  camadaId: string,
  bajasAdicionales: number,
): Promise<void> => {
  if (bajasAdicionales <= 0) return;
  const docRef = doc(db, 'camadas', camadaId);
  await updateDoc(docRef, {
    cantidadMuertes: increment(bajasAdicionales),
  });
};

/**
 * Cierra o marca una camada para venta / finalizada.
 */
export const cambiarEstadoVentaCamada = async (
  camadaId: string,
  enVenta: boolean,
  desactivar: boolean = true,
): Promise<void> => {
  const docRef = doc(db, 'camadas', camadaId);
  await updateDoc(docRef, {
    venta: enVenta,
    activa: !desactivar,
  });
};

/**
 * Elimina una camada.
 */
export const eliminarCamada = async (camadaId: string): Promise<void> => {
  const [gastosSnapshot, ventasSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'gastos'), where('camadaId', '==', camadaId))),
    getDocs(query(collection(db, 'ventas'), where('camadaId', '==', camadaId))),
  ]);
  if (!gastosSnapshot.empty) {
    throw new CamadaConGastosError(gastosSnapshot.size);
  }
  if (!ventasSnapshot.empty) {
    throw new CamadaConVentasError(ventasSnapshot.size);
  }

  const docRef = doc(db, 'camadas', camadaId);
  await deleteDoc(docRef);
};

/**
 * Consulta las próximas fechas de cambio de alimento o desparasitación en camadas activas.
 */
export const obtenerAlertasProximasCamadas = async (
  diasMargen: number = 7,
): Promise<IAlertaCamada[]> => {
  const activas = await obtenerCamadasActivas();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const margen = new Date(hoy);
  margen.setDate(margen.getDate() + diasMargen);
  margen.setHours(23, 59, 59, 999);

  const alertas: IAlertaCamada[] = [];

  activas.forEach((camada) => {
    const verificarFecha = (
      fecha: Date | null | undefined,
      tipo: IAlertaCamada['tipoAlerta'],
    ) => {
      if (!fecha) return;
      const d = new Date(fecha);
      if (d >= hoy && d <= margen) {
        const diffMs = d.getTime() - hoy.getTime();
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        alertas.push({
          camadaId: camada.id || '',
          camadaNombre: camada.nombre,
          tipoAlerta: tipo,
          fecha: d,
          diasRestantes,
        });
      }
    };

    verificarFecha(camada.fechaCambioAlimentoDesarrollo, 'Desarrollo');
    verificarFecha(camada.fechaCambioAlimentoEngorde, 'Engorde');
    verificarFecha(camada.fechaDesparasitacion, 'Desparasitación');
  });

  return alertas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
};

/**
 * Calcula un resumen general financiero y productivo de la granja (camadas activas).
 */
export const obtenerResumenGranja = async (): Promise<IResumenGranja> => {
  const activas = await obtenerCamadasActivas();

  let totalPollosVivos = 0;
  let totalMuertes = 0;
  let totalInversionActiva = 0;
  let totalPollosIniciales = 0;

  activas.forEach((c) => {
    totalPollosIniciales += c.cantidadPollos;
    totalPollosVivos += obtenerPollosVivos(c);
    totalMuertes += c.cantidadMuertes;
    totalInversionActiva += c.totalGastos;
  });

  const tasaMortalidadGlobalPct =
    totalPollosIniciales > 0
      ? Number(((totalMuertes / totalPollosIniciales) * 100).toFixed(2))
      : 0;

  return {
    totalCamadasActivas: activas.length,
    totalPollosVivos,
    totalMuertes,
    totalInversionActiva,
    tasaMortalidadGlobalPct,
  };
};

/**
 * Objeto agrupador para compatibilidad de importación estilo servicio.
 */
export const CamadaService = {
  crear: crearCamada,
  obtenerTodas: obtenerTodasLasCamadas,
  obtenerActivas: obtenerCamadasActivas,
  obtenerPorId: obtenerCamadaPorId,
  actualizar: actualizarCamada,
  registrarBajas: registrarBajasCamada,
  cambiarEstadoVenta: cambiarEstadoVentaCamada,
  eliminar: eliminarCamada,
  obtenerAlertasProximas: obtenerAlertasProximasCamadas,
  obtenerResumenGranja: obtenerResumenGranja,
};
