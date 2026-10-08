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
  type ActualizarVentaInput,
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
  const cantidadAves = Number(input.cantidadAves);
  const pesoKg = Number(input.pesoKg);
  const precioPorKg = Number(input.precioPorKg);
  if (!input.clienteId.trim() || !input.camadaId.trim()) {
    throw new Error('Selecciona un cliente y una camada.');
  }
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    throw new Error('El peso debe ser mayor a cero.');
  }
  if (!Number.isInteger(cantidadAves) || cantidadAves <= 0) {
    throw new Error(
      'La cantidad de aves vendidas debe ser un entero mayor a cero.',
    );
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
    if (
      camada.avesDisponibles === undefined ||
      camada.avesDisponibles === null
    ) {
      throw new Error(
        'La camada no tiene inventario de aves configurado. Actualiza las aves vivas disponibles antes de vender.',
      );
    }

    const stockDisponible = Number(camada.avesDisponibles);
    if (!Number.isInteger(stockDisponible) || stockDisponible < 0) {
      throw new Error('El inventario de aves de la camada no es válido.');
    }
    if (cantidadAves > stockDisponible) {
      throw new Error(
        `Aves insuficientes. La camada tiene ${stockDisponible} disponibles y la venta solicita ${cantidadAves}.`,
      );
    }
    if (Number(pesoKg.toFixed(3)) !== pesoKg) {
      throw new Error('El peso vendido admite un máximo de 3 decimales.');
    }
    const stockRestante = stockDisponible - cantidadAves;

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
      cantidadAves,
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
    transaction.update(camadaDoc, { avesDisponibles: stockRestante });
  });

  return ventaDoc.id;
};

export const actualizarVenta = async (
  ventaId: string,
  input: ActualizarVentaInput,
): Promise<void> => {
  const cantidadAves = Number(input.cantidadAves);
  const pesoKg = Number(input.pesoKg);
  const precioPorKg = Number(input.precioPorKg);
  if (!input.clienteId.trim()) throw new Error('Selecciona un cliente.');
  if (!Number.isInteger(cantidadAves) || cantidadAves < 0) {
    throw new Error(
      'La cantidad de aves debe ser un entero igual o mayor a cero.',
    );
  }
  if (
    !Number.isFinite(pesoKg) ||
    pesoKg <= 0 ||
    Number(pesoKg.toFixed(3)) !== pesoKg
  ) {
    throw new Error(
      'El peso debe ser mayor a cero y admitir máximo 3 decimales.',
    );
  }
  if (!Number.isFinite(precioPorKg) || precioPorKg <= 0) {
    throw new Error('El precio por kg debe ser mayor a cero.');
  }

  const ventaDoc = doc(db, 'ventas', ventaId);
  await runTransaction(db, async (transaction) => {
    const ventaSnapshot = await transaction.get(ventaDoc);
    if (!ventaSnapshot.exists())
      throw new Error('La venta ya no existe. Actualiza la lista.');

    const ventaAnterior = ventaSnapshot.data();
    const camadaId = String(ventaAnterior.camadaId || '').trim();
    if (!camadaId) throw new Error('La venta no tiene una camada asociada.');

    const clienteDoc = doc(db, 'clientes', input.clienteId);
    const camadaDoc = doc(db, 'camadas', camadaId);
    const [clienteSnapshot, camadaSnapshot] = await Promise.all([
      transaction.get(clienteDoc),
      transaction.get(camadaDoc),
    ]);
    if (!clienteSnapshot.exists())
      throw new Error('El cliente seleccionado ya no existe.');
    if (!camadaSnapshot.exists())
      throw new Error('La camada original ya no existe.');

    const camada = camadaSnapshot.data();
    if (
      camada.avesDisponibles === undefined ||
      camada.avesDisponibles === null
    ) {
      throw new Error(
        'Configura las aves disponibles de la camada antes de editar la venta.',
      );
    }
    const avesEnStock = Number(camada.avesDisponibles);
    if (!Number.isInteger(avesEnStock) || avesEnStock < 0) {
      throw new Error('El inventario actual de aves no es válido.');
    }

    const avesVentaAnterior = Number(ventaAnterior.cantidadAves) || 0;
    if (avesVentaAnterior === 0 && cantidadAves !== 0) {
      throw new Error(
        'Esta venta antigua no tiene conteo de aves; no se puede cambiar su inventario con seguridad.',
      );
    }
    if (avesVentaAnterior > 0 && cantidadAves === 0) {
      throw new Error(
        'Una venta con stock registrado debe conservar una cantidad de aves mayor a cero.',
      );
    }
    const stockAjustado = avesEnStock + avesVentaAnterior;
    if (cantidadAves > stockAjustado) {
      throw new Error(
        `Aves insuficientes. Hay ${stockAjustado} disponibles al revertir esta venta.`,
      );
    }

    const costoOperacionPorKg = Number(ventaAnterior.costoOperacionPorKg) || 0;
    const { totalVenta, costoOperacion, ganancia } = calcularImportesVenta(
      pesoKg,
      precioPorKg,
      costoOperacionPorKg,
    );
    const montoPagado = Number(ventaAnterior.montoPagado) || 0;
    if (totalVenta < montoPagado) {
      throw new Error(
        `El nuevo total no puede ser menor a lo ya cobrado (${formatCurrency(montoPagado)}).`,
      );
    }
    const saldoPendiente =
      Math.round((totalVenta - montoPagado + Number.EPSILON) * 100) / 100;
    if (input.modalidad === 'contado' && saldoPendiente > 0) {
      throw new Error(
        'El total editado supera lo cobrado. Mantén la venta a crédito para conservar el saldo pendiente.',
      );
    }
    if (
      input.modalidad === 'credito' &&
      (!input.fechaVencimiento || input.fechaVencimiento < input.fecha)
    ) {
      throw new Error(
        'El crédito requiere un vencimiento igual o posterior a la fecha de venta.',
      );
    }

    const cliente = clienteSnapshot.data();
    const estado =
      saldoPendiente === 0
        ? 'pagada'
        : montoPagado > 0
          ? 'parcial'
          : 'pendiente';
    transaction.update(ventaDoc, {
      clienteId: input.clienteId,
      clienteNombre: String(cliente.nombre || '').trim(),
      clienteTelefono: String(cliente.telefono || '').trim(),
      fecha: Timestamp.fromDate(input.fecha),
      cantidadAves,
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
      updatedAt: serverTimestamp(),
    });
    transaction.update(camadaDoc, {
      avesDisponibles: stockAjustado - cantidadAves,
    });
  });
};

export const eliminarVenta = async (ventaId: string): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const ventaDoc = doc(db, 'ventas', ventaId);
    const ventaSnapshot = await transaction.get(ventaDoc);
    if (!ventaSnapshot.exists()) return;

    const venta = ventaSnapshot.data();
    const camadaId = String(venta.camadaId || '').trim();
    if (!camadaId) throw new Error('La venta no tiene una camada asociada.');
    const cantidadAves = Number(venta.cantidadAves) || 0;

    if (cantidadAves > 0) {
      const camadaDoc = doc(db, 'camadas', camadaId);
      const camadaSnapshot = await transaction.get(camadaDoc);
      if (!camadaSnapshot.exists())
        throw new Error('La camada asociada a la venta ya no existe.');
      const avesDisponibles = camadaSnapshot.data().avesDisponibles;
      if (avesDisponibles === undefined || avesDisponibles === null) {
        throw new Error(
          'Configura las aves disponibles de la camada antes de eliminar la venta y devolver su stock.',
        );
      }
      const stockActual = Number(avesDisponibles);
      if (!Number.isInteger(stockActual) || stockActual < 0) {
        throw new Error('El inventario actual de aves no es válido.');
      }
      transaction.update(camadaDoc, {
        avesDisponibles: stockActual + cantidadAves,
      });
    }

    transaction.delete(ventaDoc);
  });
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
  actualizar: actualizarVenta,
  eliminar: eliminarVenta,
  registrarAbono: registrarAbonoVenta,
};
