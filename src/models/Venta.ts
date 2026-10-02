import { DocumentData, Timestamp } from 'firebase/firestore';

export type ModalidadVenta = 'contado' | 'credito';
export type EstadoVenta = 'pagada' | 'pendiente' | 'parcial';

export interface AbonoVenta {
  id: string;
  monto: number;
  fecha: Date;
  nota?: string;
}

export interface Venta {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  camadaId: string;
  camadaNombre: string;
  fecha: Date;
  pesoKg: number;
  precioPorKg: number;
  costoOperacionPorKg: number;
  totalVenta: number;
  costoOperacion: number;
  ganancia: number;
  modalidad: ModalidadVenta;
  estado: EstadoVenta;
  montoPagado: number;
  saldoPendiente: number;
  fechaVencimiento: Date | null;
  abonos: AbonoVenta[];
  createdAt?: Date;
}

export interface NuevaVentaInput {
  clienteId: string;
  camadaId: string;
  fecha: Date;
  pesoKg: number;
  precioPorKg: number;
  modalidad: ModalidadVenta;
  abonoInicial: number;
  fechaVencimiento?: Date | null;
}

const redondearMoneda = (valor: number): number =>
  Math.round((valor + Number.EPSILON) * 100) / 100;

export const calcularImportesVenta = (
  pesoKg: number,
  precioPorKg: number,
  costoOperacionPorKg: number,
) => {
  const totalVenta = redondearMoneda(pesoKg * precioPorKg);
  const costoOperacion = redondearMoneda(pesoKg * costoOperacionPorKg);
  return {
    totalVenta,
    costoOperacion,
    ganancia: redondearMoneda(totalVenta - costoOperacion),
  };
};

const convertirFecha = (valor: any): Date | null => {
  if (!valor) return null;
  if (valor instanceof Timestamp) return valor.toDate();
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (typeof valor === 'string' || typeof valor === 'number') {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
};

export const ventaFromFirestore = (id: string, data: DocumentData): Venta => ({
  id,
  clienteId: String(data.clienteId || ''),
  clienteNombre: String(data.clienteNombre || ''),
  clienteTelefono: String(data.clienteTelefono || ''),
  camadaId: String(data.camadaId || ''),
  camadaNombre: String(data.camadaNombre || ''),
  fecha: convertirFecha(data.fecha) || new Date(),
  pesoKg: Number(data.pesoKg) || 0,
  precioPorKg: Number(data.precioPorKg) || 0,
  costoOperacionPorKg: Number(data.costoOperacionPorKg) || 0,
  totalVenta: Number(data.totalVenta) || 0,
  costoOperacion: Number(data.costoOperacion) || 0,
  ganancia: Number(data.ganancia) || 0,
  modalidad: data.modalidad === 'credito' ? 'credito' : 'contado',
  estado:
    data.estado === 'pagada' || data.estado === 'parcial'
      ? data.estado
      : 'pendiente',
  montoPagado: Number(data.montoPagado) || 0,
  saldoPendiente: Number(data.saldoPendiente) || 0,
  fechaVencimiento: convertirFecha(data.fechaVencimiento),
  abonos: Array.isArray(data.abonos)
    ? data.abonos.map((abono: any, index: number) => ({
        id: String(abono.id || index),
        monto: Number(abono.monto) || 0,
        fecha: convertirFecha(abono.fecha) || new Date(),
        nota: String(abono.nota || ''),
      }))
    : [],
  createdAt: convertirFecha(data.createdAt) || undefined,
});
