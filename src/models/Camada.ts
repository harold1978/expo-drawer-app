import { DocumentData, Timestamp } from 'firebase/firestore';

/**
 * Interfaz que representa una Camada (Lote de pollos).
 */
export interface Camada {
  id?: string;
  nombre: string;
  cantidadPollos: number;
  fechaIngreso: Date;
  fechaCambioAlimentoDesarrollo?: Date | null;
  fechaCambioAlimentoEngorde?: Date | null;
  fechaDesparasitacion?: Date | null;
  cantidadMuertes: number;
  activa: boolean;
  venta: boolean;
  totalGastos: number;
  createdAt?: Date;
}

/**
 * Tipo para crear una nueva camada omitiendo campos automáticos.
 */
export type NuevaCamadaInput = Omit<
  Camada,
  'id' | 'cantidadMuertes' | 'activa' | 'venta' | 'totalGastos' | 'createdAt'
> & {
  cantidadMuertes?: number;
  activa?: boolean;
  venta?: boolean;
  totalGastos?: number;
};

// ==========================================
// Funciones de Negocio y Métricas Avícolas
// ==========================================

/**
 * Retorna la cantidad de aves vivas actualmente.
 */
export const obtenerPollosVivos = (camada: Pick<Camada, 'cantidadPollos' | 'cantidadMuertes'>): number => {
  return Math.max(0, camada.cantidadPollos - camada.cantidadMuertes);
};

/**
 * Retorna el porcentaje de mortalidad acumulado de la camada.
 */
export const obtenerTasaMortalidad = (camada: Pick<Camada, 'cantidadPollos' | 'cantidadMuertes'>): number => {
  if (camada.cantidadPollos <= 0) return 0;
  return Number(((camada.cantidadMuertes / camada.cantidadPollos) * 100).toFixed(2));
};

/**
 * Retorna el costo acumulado por cada ave viva disponible.
 */
export const obtenerCostoPorPolloVivo = (
  camada: Pick<Camada, 'cantidadPollos' | 'cantidadMuertes' | 'totalGastos'>
): number => {
  const vivos = obtenerPollosVivos(camada);
  if (vivos <= 0) return 0;
  return Number((camada.totalGastos / vivos).toFixed(2));
};

/**
 * Retorna los días transcurridos desde el ingreso de la camada.
 */
export const obtenerDiasDeCria = (fechaIngreso: Date): number => {
  const ahora = new Date().getTime();
  const ingreso = fechaIngreso.getTime();
  const diff = ahora - ingreso;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

/**
 * Calcula todas las métricas resumidas de una camada.
 */
export const calcularMetricasCamada = (camada: Camada) => {
  const vivos = obtenerPollosVivos(camada);
  const mortalidad = obtenerTasaMortalidad(camada);
  const costoUnitario = obtenerCostoPorPolloVivo(camada);
  const dias = obtenerDiasDeCria(camada.fechaIngreso);

  return {
    pollosIniciales: camada.cantidadPollos,
    muertes: camada.cantidadMuertes,
    pollosVivos: vivos,
    tasaMortalidad: mortalidad,
    tasaMortalidadTexto: `${mortalidad}%`,
    costoTotalGastos: camada.totalGastos,
    costoPorPolloVivo: costoUnitario,
    costoPorPolloVivoTexto: `$${costoUnitario}`,
    diasDeCria: dias,
  };
};

// ==========================================
// Serialización y Deserialización Firestore
// ==========================================

export const camadaToFirestore = (
  camada: NuevaCamadaInput | Partial<Camada>
): Record<string, any> => {
  return {
    nombre: camada.nombre,
    cantidadPollos: Number(camada.cantidadPollos) || 0,
    fechaIngreso: camada.fechaIngreso ? Timestamp.fromDate(camada.fechaIngreso) : Timestamp.now(),
    fechaCambioAlimentoDesarrollo: camada.fechaCambioAlimentoDesarrollo
      ? Timestamp.fromDate(camada.fechaCambioAlimentoDesarrollo)
      : null,
    fechaCambioAlimentoEngorde: camada.fechaCambioAlimentoEngorde
      ? Timestamp.fromDate(camada.fechaCambioAlimentoEngorde)
      : null,
    fechaDesparasitacion: camada.fechaDesparasitacion
      ? Timestamp.fromDate(camada.fechaDesparasitacion)
      : null,
    cantidadMuertes: camada.cantidadMuertes ?? 0,
    activa: camada.activa ?? true,
    venta: camada.venta ?? false,
    totalGastos: camada.totalGastos ?? 0,
  };
};

export const camadaFromFirestore = (id: string, data: DocumentData): Camada => {
  const toDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Timestamp) return val.toDate();
    if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
    if (typeof val === 'string' || typeof val === 'number') return new Date(val);
    return null;
  };

  return {
    id,
    nombre: data.nombre || '',
    cantidadPollos: Number(data.cantidadPollos) || 0,
    fechaIngreso: toDate(data.fechaIngreso) || new Date(),
    fechaCambioAlimentoDesarrollo: toDate(data.fechaCambioAlimentoDesarrollo),
    fechaCambioAlimentoEngorde: toDate(data.fechaCambioAlimentoEngorde),
    fechaDesparasitacion: toDate(data.fechaDesparasitacion),
    cantidadMuertes: Number(data.cantidadMuertes) || 0,
    activa: data.activa ?? true,
    venta: data.venta ?? false,
    totalGastos: Number(data.totalGastos) || 0,
    createdAt: toDate(data.createdAt) || new Date(),
  };
};
