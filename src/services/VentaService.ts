import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatCurrency } from '../utils/format';
import {
  calcularImportesVenta,
  ventaFromFirestore,
  type NuevaVentaInput,
  type Venta,
} from '../models/Venta';

const ventasRef = collection(db, 'ventas');

export const obtenerVentas = async (): Promise<Venta[]> => {
  const snapshot = await getDocs(query(ventasRef, orderBy('fecha', 'desc')));
  return snapshot.docs.map((documento) =>
    ventaFromFirestore(documento.id, documento.data()),
  );
};

export const crearVenta = async (input: NuevaVentaInput): Promise<string> => {
  const pesoKg = Number(input.pesoKg);
  const precioPorKg = Number(input.precioPorKg);
  if (!input.clienteId.trim() || !input.camadaId.trim()) {
    throw new Error('Selecciona un cliente y una camada.');
  }
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    throw new Error('El peso debe ser mayor a cero.');
  }
  if (!Number.isFinite(precioPorKg) || precioPorKg <= 0) {
    throw new Error('El precio por kg debe ser mayor a cero.');
  }

  const ventaDoc = doc(ventasRef);
  const clienteDoc = doc(db, 'clientes', input.clienteId);
  const camadaDoc = doc(db, 'camadas', input.camadaId);

  await runTransaction(db, async (transaction) => {
    const [clienteSnapshot, camadaSnapshot] = await Promise.all([
      transaction.get(clienteDoc),
      transaction.get(camadaDoc),
    ]);
    if (!clienteSnapshot.exists())
      throw new Error('El cliente seleccionado ya no existe.');
    if (!camadaSnapshot.exists())
      throw new Error('La camada seleccionada ya no existe.');

    const cliente = clienteSnapshot.data();
    const camada = camadaSnapshot.data();
    if (camada.activa === false)
      throw new Error(
        'No se pueden registrar ventas en una camada finalizada.',
      );

    const costoOperacionPorKg = Number(camada.costoOperacionPorKg) || 0;
    const { totalVenta, costoOperacion, ganancia } = calcularImportesVenta(
      pesoKg,
      precioPorKg,
      costoOperacionPorKg,
    );
    const montoPagado =
      input.modalidad === 'contado'
        ? totalVenta
        : Number(input.abonoInicial) || 0;
    if (
      !Number.isFinite(montoPagado) ||
      montoPagado < 0 ||
      montoPagado > totalVenta
    ) {
      throw new Error(
        'El abono inicial debe estar entre cero y el total de la venta.',
      );
    }
    if (input.modalidad === 'credito') {
      if (!input.fechaVencimiento || input.fechaVencimiento < input.fecha) {
        throw new Error(
          'El crédito requiere una fecha de vencimiento igual o posterior a la venta.',
        );
      }
    }

    const saldoPendiente =
      Math.round((totalVenta - montoPagado + Number.EPSILON) * 100) / 100;
    const estado =
      saldoPendiente === 0
        ? 'pagada'
        : montoPagado > 0
          ? 'parcial'
          : 'pendiente';
    const abonos =
      montoPagado > 0
        ? [
            {
              id: 'inicial',
              monto: montoPagado,
              fecha: Timestamp.fromDate(input.fecha),
              nota: 'Pago inicial',
            },
          ]
        : [];

    transaction.set(ventaDoc, {
      clienteId: input.clienteId,
      clienteNombre: String(cliente.nombre || '').trim(),
      clienteTelefono: String(cliente.telefono || '').trim(),
      camadaId: input.camadaId,
      camadaNombre: String(camada.nombre || '').trim(),
      fecha: Timestamp.fromDate(input.fecha),
      pesoKg,
      precioPorKg,
      costoOperacionPorKg,
      totalVenta,
      costoOperacion,
      ganancia,
      modalidad: input.modalidad,
      estado,
      montoPagado,
      saldoPendiente,
      fechaVencimiento:
        input.modalidad === 'credito' && input.fechaVencimiento
          ? Timestamp.fromDate(input.fechaVencimiento)
          : null,
      abonos,
      createdAt: serverTimestamp(),
    });
  });

  return ventaDoc.id;
};

export const registrarAbonoVenta = async (
  ventaId: string,
  monto: number,
  nota = '',
): Promise<void> => {
  const cantidad = Number(monto);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error('El abono debe ser mayor a cero.');
  }

  const ventaDoc = doc(db, 'ventas', ventaId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ventaDoc);
    if (!snapshot.exists()) throw new Error('La venta ya no existe.');

    const venta = snapshot.data();
    const saldo =
      Math.round((Number(venta.saldoPendiente) + Number.EPSILON) * 100) / 100;
    if (cantidad > saldo)
      throw new Error(
        `El abono no puede superar el saldo de ${formatCurrency(saldo)}.`,
      );

    const nuevoSaldo =
      Math.round((saldo - cantidad + Number.EPSILON) * 100) / 100;
    transaction.update(ventaDoc, {
      abonos: arrayUnion({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        monto: cantidad,
        fecha: Timestamp.now(),
        nota: nota.trim(),
      }),
      montoPagado: increment(cantidad),
      saldoPendiente: nuevoSaldo,
      estado: nuevoSaldo === 0 ? 'pagada' : 'parcial',
    });
  });
};

export const VentaService = {
  obtenerTodas: obtenerVentas,
  crear: crearVenta,
  registrarAbono: registrarAbonoVenta,
};
