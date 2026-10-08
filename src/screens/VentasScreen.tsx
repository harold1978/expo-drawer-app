import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { Camada } from '../models/Camada';
import type { Cliente } from '../models/Cliente';
import {
    calcularImportesVenta,
    type ModalidadVenta,
    type Venta,
} from '../models/Venta';
import { obtenerCamadasActivas } from '../services/CamadaService';
import { obtenerClientes } from '../services/ClienteService';
import {
    actualizarVenta,
    crearVenta,
    eliminarVenta,
    obtenerVentas,
    registrarAbonoVenta,
} from '../services/VentaService';
import type { RootDrawerNavigationProp, RootDrawerParamList } from '../navigation/types';
import { formatCurrency, formatDate, formatNumber, parseDateInput, showAlert } from '../utils';

interface FormVenta {
    clienteId: string;
    camadaId: string;
    cantidadAves: string;
    pesoKg: string;
    precioPorKg: string;
    modalidad: ModalidadVenta;
    abonoInicial: string;
    fecha: string;
    fechaVencimiento: string;
}

const fechaAInput = formatDate;
const fechaDesdeInput = parseDateInput;
const moneda = formatCurrency;
const fechaTexto = formatDate;

const formularioVacio = (): FormVenta => ({
    clienteId: '',
    camadaId: '',
    cantidadAves: '',
    pesoKg: '',
    precioPorKg: '',
    modalidad: 'contado',
    abonoInicial: '',
    fecha: fechaAInput(new Date()),
    fechaVencimiento: '',
});

export const VentasScreen: React.FC = () => {
    const navigation = useNavigation<RootDrawerNavigationProp<'Ventas'>>();
    const route = useRoute<RouteProp<RootDrawerParamList, 'Ventas'>>();
    const camadaFiltroId = route.params?.camadaId;
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [camadas, setCamadas] = useState<Camada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [modalVentaVisible, setModalVentaVisible] = useState(false);
    const [ventaEditando, setVentaEditando] = useState<Venta | null>(null);
    const [modalSelector, setModalSelector] = useState<'cliente' | 'camada' | null>(null);
    const [form, setForm] = useState<FormVenta>(formularioVacio);
    const [errorForm, setErrorForm] = useState('');
    const [ventaAbonar, setVentaAbonar] = useState<Venta | null>(null);
    const [montoAbono, setMontoAbono] = useState('');
    const [notaAbono, setNotaAbono] = useState('');

    const cargarDatos = useCallback(async (refresco = false) => {
        if (refresco) setRefrescando(true);
        else setCargando(true);
        try {
            const [ventasData, clientesData, camadasData] = await Promise.all([
                obtenerVentas(),
                obtenerClientes(),
                obtenerCamadasActivas(),
            ]);
            setVentas(ventasData);
            setClientes(clientesData);
            setCamadas(camadasData);
        } catch (error) {
            console.error('Error al cargar ventas:', error);
            showAlert('Error', 'No se pudieron cargar ventas, clientes o camadas.');
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    }, []);

    useEffect(() => {
        void cargarDatos();
    }, [cargarDatos]);

    const clienteSeleccionado = clientes.find((cliente) => cliente.id === form.clienteId);
    const camadaSeleccionada = camadas.find((camada) => camada.id === form.camadaId);
    const costoOperacionPorKg = ventaEditando?.costoOperacionPorKg ?? camadaSeleccionada?.costoOperacionPorKg ?? 0;
    const pesoPreview = Number(form.pesoKg.replace(',', '.')) || 0;
    const precioPreview = Number(form.precioPorKg.replace(',', '.')) || 0;
    const calculoPreview = useMemo(
        () => calcularImportesVenta(pesoPreview, precioPreview, costoOperacionPorKg),
        [pesoPreview, precioPreview, costoOperacionPorKg],
    );

    const ventasVisibles = useMemo(
        () => camadaFiltroId ? ventas.filter((venta) => venta.camadaId === camadaFiltroId) : ventas,
        [camadaFiltroId, ventas],
    );

    const resumen = useMemo(() => ventasVisibles.reduce((acumulado, venta) => ({
        totalVendido: acumulado.totalVendido + venta.totalVenta,
        ganancia: acumulado.ganancia + venta.ganancia,
        porCobrar: acumulado.porCobrar + venta.saldoPendiente,
    }), { totalVendido: 0, ganancia: 0, porCobrar: 0 }), [ventasVisibles]);

    const abrirNuevaVenta = () => {
        if (clientes.length === 0) {
            showAlert('Faltan clientes', 'Registra al menos un cliente antes de capturar una venta.');
            navigation.navigate('Clientes');
            return;
        }
        if (camadas.length === 0) {
            showAlert('Faltan camadas activas', 'Registra o reactiva una camada antes de capturar una venta.');
            navigation.navigate('Camadas');
            return;
        }
        if (camadas.every((camada) => camada.avesDisponibles === null || camada.avesDisponibles <= 0)) {
            showAlert('Sin aves disponibles', 'Configura las aves vivas de una camada antes de registrar ventas.');
            navigation.navigate('Camadas');
            return;
        }
        setVentaEditando(null);
        setForm({ ...formularioVacio(), camadaId: camadaFiltroId || '' });
        setErrorForm('');
        setModalVentaVisible(true);
    };

    const abrirEdicionVenta = (venta: Venta) => {
        setVentaEditando(venta);
        setForm({
            clienteId: venta.clienteId,
            camadaId: venta.camadaId,
            cantidadAves: String(venta.cantidadAves),
            pesoKg: String(venta.pesoKg),
            precioPorKg: String(venta.precioPorKg),
            modalidad: venta.modalidad,
            abonoInicial: String(venta.montoPagado),
            fecha: formatDate(venta.fecha),
            fechaVencimiento: venta.fechaVencimiento ? formatDate(venta.fechaVencimiento) : '',
        });
        setErrorForm('');
        setModalVentaVisible(true);
    };

    const cerrarModalVenta = () => {
        setModalVentaVisible(false);
        setVentaEditando(null);
        setErrorForm('');
    };

    const guardarVenta = async () => {
        const cantidadAves = Number(form.cantidadAves);
        const pesoKg = Number(form.pesoKg.replace(',', '.'));
        const precioPorKg = Number(form.precioPorKg.replace(',', '.'));
        const fecha = fechaDesdeInput(form.fecha);
        const fechaVencimiento = fechaDesdeInput(form.fechaVencimiento);
        const abonoInicial = Number(form.abonoInicial.replace(',', '.')) || 0;

        if (!form.clienteId || !form.camadaId) {
            setErrorForm('Selecciona un cliente y una camada.');
            return;
        }
        const ventaHistoricaSinConteo = ventaEditando?.cantidadAves === 0;
        if (!Number.isInteger(cantidadAves) || cantidadAves < (ventaHistoricaSinConteo ? 0 : 1)) {
            setErrorForm('La cantidad de aves vendidas debe ser un entero válido.');
            return;
        }
        if (ventaHistoricaSinConteo && cantidadAves !== 0) {
            setErrorForm('Esta venta antigua no tiene conteo de aves; no se puede cambiar su inventario con seguridad.');
            return;
        }
        if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
            setErrorForm('El peso debe ser mayor a cero.');
            return;
        }
        if (Number(pesoKg.toFixed(3)) !== pesoKg) {
            setErrorForm('El peso admite un máximo de 3 decimales.');
            return;
        }
        if (!ventaEditando && (!camadaSeleccionada || camadaSeleccionada.avesDisponibles === null)) {
            setErrorForm('La camada no tiene aves disponibles configuradas. Actualízala en Camadas.');
            return;
        }
        const stockDisponibleParaEditar = camadaSeleccionada?.avesDisponibles == null
            ? null
            : camadaSeleccionada.avesDisponibles + (ventaEditando?.cantidadAves || 0);
        if (stockDisponibleParaEditar !== null && cantidadAves > stockDisponibleParaEditar) {
            setErrorForm(`Stock insuficiente: quedan ${formatNumber(stockDisponibleParaEditar)} aves disponibles al revertir esta venta.`);
            return;
        }
        if (!Number.isFinite(precioPorKg) || precioPorKg <= 0) {
            setErrorForm('El precio de venta por kg debe ser mayor a cero.');
            return;
        }
        if (!fecha) {
            setErrorForm('Ingresa una fecha de venta válida.');
            return;
        }
        if (form.modalidad === 'credito' && (!fechaVencimiento || fechaVencimiento < fecha)) {
            setErrorForm('El vencimiento debe ser igual o posterior a la fecha de venta.');
            return;
        }
        if (form.modalidad === 'credito' && (abonoInicial < 0 || abonoInicial > calculoPreview.totalVenta)) {
            setErrorForm('El anticipo debe estar entre cero y el total de la venta.');
            return;
        }

        try {
            setGuardando(true);
            if (ventaEditando?.id) {
                await actualizarVenta(ventaEditando.id, {
                    clienteId: form.clienteId,
                    fecha,
                    cantidadAves,
                    pesoKg,
                    precioPorKg,
                    modalidad: form.modalidad,
                    fechaVencimiento: form.modalidad === 'credito' ? fechaVencimiento : null,
                });
            } else {
                await crearVenta({
                    clienteId: form.clienteId,
                    camadaId: form.camadaId,
                    fecha,
                    cantidadAves,
                    pesoKg,
                    precioPorKg,
                    modalidad: form.modalidad,
                    abonoInicial: form.modalidad === 'contado' ? calculoPreview.totalVenta : abonoInicial,
                    fechaVencimiento: form.modalidad === 'credito' ? fechaVencimiento : null,
                });
            }
            setModalVentaVisible(false);
            setVentaEditando(null);
            await cargarDatos();
        } catch (error) {
            console.error('Error al registrar venta:', error);
            setErrorForm(error instanceof Error ? error.message : 'No se pudo registrar la venta.');
        } finally {
            setGuardando(false);
        }
    };

    const guardarAbono = async () => {
        if (!ventaAbonar?.id) return;
        const monto = Number(montoAbono.replace(',', '.'));
        if (!Number.isFinite(monto) || monto <= 0) {
            showAlert('Monto no válido', 'Ingresa un abono mayor a cero.');
            return;
        }
        try {
            setGuardando(true);
            await registrarAbonoVenta(ventaAbonar.id, monto, notaAbono);
            setVentaAbonar(null);
            setMontoAbono('');
            setNotaAbono('');
            await cargarDatos();
        } catch (error) {
            showAlert('No se pudo registrar el abono', error instanceof Error ? error.message : 'Intenta de nuevo.');
        } finally {
            setGuardando(false);
        }
    };

    const solicitarEliminacion = (venta: Venta) => {
        if (!venta.id) return;
        const devolucionStock = venta.cantidadAves > 0
            ? `Se devolverán ${formatNumber(venta.cantidadAves)} aves al stock.`
            : 'Esta venta no tiene conteo histórico de aves y no modificará el stock.';
        showAlert(
            'Eliminar venta',
            `¿Eliminar la venta de ${venta.clienteNombre} por ${moneda(venta.totalVenta)}? ${devolucionStock} También se eliminará su historial de pagos.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => void confirmarEliminacion(venta) },
            ],
        );
    };

    const confirmarEliminacion = async (venta: Venta) => {
        if (!venta.id) return;
        try {
            setGuardando(true);
            await eliminarVenta(venta.id);
            await cargarDatos();
        } catch (error) {
            showAlert('No se pudo eliminar la venta', error instanceof Error ? error.message : 'Intenta de nuevo.');
        } finally {
            setGuardando(false);
        }
    };

    const campoFecha = (label: string, value: string, onChange: (text: string) => void) => (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="dd-mm-yyyy" placeholderTextColor={COLORS.textSecondary} maxLength={10} />
        </View>
    );

    const estadoLabel = (venta: Venta) => {
        if (venta.estado === 'pagada') return 'Pagada';
        if (venta.estado === 'parcial') return 'Abono parcial';
        return 'Pendiente';
    };

    const estadoStyle = (venta: Venta) => venta.estado === 'pagada'
        ? styles.statusPaid
        : venta.estado === 'parcial' ? styles.statusPartial : styles.statusDue;

    const renderVenta = (venta: Venta) => (
        <View key={venta.id} style={styles.saleRow}>
            <View style={styles.saleHeading}>
                <View style={styles.saleTitleBlock}>
                    <Text style={styles.clientName}>{venta.clienteNombre}</Text>
                    <Text style={styles.saleMeta}>{venta.camadaNombre} · {fechaTexto(venta.fecha)}</Text>
                </View>
                <View style={[styles.status, estadoStyle(venta)]}>
                    <Text style={styles.statusText}>{venta.modalidad === 'contado' ? 'Contado' : 'Crédito · ' + estadoLabel(venta)}</Text>
                </View>
            </View>
            <View style={styles.saleFacts}>
                <Text style={styles.factText}>
                    {venta.cantidadAves > 0 ? `${formatNumber(venta.cantidadAves)} aves · ` : ''}
                    {formatNumber(venta.pesoKg)} kg × {moneda(venta.precioPorKg)}/kg
                </Text>
                <Text style={styles.factText}>Costo {moneda(venta.costoOperacion)} · Ganancia <Text style={styles.profit}>{moneda(venta.ganancia)}</Text></Text>
            </View>
            <View style={styles.saleFooter}>
                <View>
                    <Text style={styles.totalLabel}>Total vendido</Text>
                    <Text style={styles.totalValue}>{moneda(venta.totalVenta)}</Text>
                    {venta.fechaVencimiento ? <Text style={styles.dueDate}>Vence {fechaTexto(venta.fechaVencimiento)}</Text> : null}
                </View>
                {venta.modalidad === 'credito' && venta.saldoPendiente > 0 ? (
                    <TouchableOpacity style={styles.outstandingButton} onPress={() => { setVentaAbonar(venta); setMontoAbono(''); setNotaAbono(''); }}>
                        <Ionicons name="cash-outline" size={17} color={COLORS.primary} />
                        <Text style={styles.outstandingText}>Abonar {moneda(venta.saldoPendiente)}</Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.paidText}>Cobrado {moneda(venta.montoPagado)}</Text>
                )}
            </View>
            {venta.abonos.length > 0 ? <Text style={styles.paymentMeta}>{venta.abonos.length} {venta.abonos.length === 1 ? 'pago registrado' : 'pagos registrados'} · Acumulado {moneda(venta.montoPagado)}</Text> : null}
            <View style={styles.saleActions}>
                <TouchableOpacity style={styles.saleActionButton} onPress={() => abrirEdicionVenta(venta)} accessibilityLabel={`Editar venta de ${venta.clienteNombre}`}>
                    <Ionicons name="pencil-outline" size={17} color={COLORS.primary} />
                    <Text style={styles.saleActionText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saleActionButton, styles.deleteSaleButton]} onPress={() => solicitarEliminacion(venta)} accessibilityLabel={`Eliminar venta de ${venta.clienteNombre}`}>
                    <Ionicons name="trash-outline" size={17} color="#C43D3D" />
                    <Text style={styles.deleteSaleText}>Eliminar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (cargando) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.muted}>Cargando ventas...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerCopy}>
                    <Text style={styles.heading}>Ventas</Text>
                    <Text style={styles.subheading}>
                        {ventasVisibles.length} operaciones {camadaFiltroId ? 'de esta camada' : 'registradas'}
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    {Platform.OS === 'web' ? <TouchableOpacity style={styles.iconButton} onPress={() => void cargarDatos(true)} accessibilityLabel="Actualizar ventas"><Ionicons name="refresh-outline" size={19} color={COLORS.primary} /></TouchableOpacity> : null}
                    <TouchableOpacity style={styles.clientsButton} onPress={() => navigation.navigate('Clientes')}>
                        <Ionicons name="people-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.clientsButtonText}>Clientes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryButton} onPress={abrirNuevaVenta}>
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.primaryButtonText}>Nueva venta</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => void cargarDatos(true)} colors={[COLORS.primary]} />}>
                <View style={styles.summary}>
                    <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Vendido</Text><Text style={styles.summaryValue}>{moneda(resumen.totalVendido)}</Text></View>
                    <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Ganancia</Text><Text style={[styles.summaryValue, styles.profit]}>{moneda(resumen.ganancia)}</Text></View>
                    <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Por cobrar</Text><Text style={styles.summaryValue}>{moneda(resumen.porCobrar)}</Text></View>
                </View>
                {ventasVisibles.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="cart-outline" size={42} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTitle}>{camadaFiltroId ? 'Esta camada aún no tiene ventas' : 'Aún no hay ventas'}</Text>
                        <Text style={styles.muted}>Registra ventas por kg y consulta su ganancia y saldo.</Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={abrirNuevaVenta}><Ionicons name="add" size={19} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Registrar venta</Text></TouchableOpacity>
                    </View>
                ) : ventasVisibles.map(renderVenta)}
            </ScrollView>

            <Modal visible={modalVentaVisible} transparent animationType="fade" onRequestClose={cerrarModalVenta}>
                <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
                        <View style={styles.modal}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{ventaEditando ? 'Editar venta' : 'Nueva venta'}</Text>
                                <TouchableOpacity onPress={cerrarModalVenta} disabled={guardando} accessibilityLabel="Cerrar formulario"><Ionicons name="close" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Cliente *</Text>
                            <TouchableOpacity style={styles.selector} onPress={() => setModalSelector('cliente')}>
                                <Text style={[styles.selectorText, !clienteSeleccionado && styles.placeholder]}>{clienteSeleccionado?.nombre || 'Seleccionar cliente'}</Text>
                                <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                            {ventaEditando ? (
                                <View style={styles.field}>
                                    <Text style={styles.label}>Camada</Text>
                                    <Text style={styles.readOnlyValue}>{ventaEditando.camadaNombre}</Text>
                                </View>
                            ) : (
                                <>
                                    <Text style={styles.label}>Camada activa *</Text>
                                    <TouchableOpacity style={styles.selector} onPress={() => setModalSelector('camada')}>
                                        <Text style={[styles.selectorText, !camadaSeleccionada && styles.placeholder]}>{camadaSeleccionada?.nombre || 'Seleccionar camada'}</Text>
                                        <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                                    </TouchableOpacity>
                                </>
                            )}
                            {ventaEditando ? (
                                <Text style={styles.rateHint}>
                                    Cobrado: {moneda(ventaEditando.montoPagado)} · Saldo actual: {moneda(ventaEditando.saldoPendiente)}
                                </Text>
                            ) : camadaSeleccionada ? (
                                <Text style={styles.rateHint}>
                                    Aves disponibles: {camadaSeleccionada.avesDisponibles === null ? 'sin configurar' : formatNumber(camadaSeleccionada.avesDisponibles)}
                                    {' · '}Costo operativo: {moneda(camadaSeleccionada.costoOperacionPorKg || 0)}/kg
                                </Text>
                            ) : null}

                            <View style={styles.twoColumns}>
                                <View style={styles.column}>
                                    <Text style={styles.label}>{ventaEditando?.cantidadAves === 0 ? 'Aves (dato histórico desconocido)' : 'Aves vendidas *'}</Text>
                                    <TextInput
                                        style={[styles.input, ventaEditando?.cantidadAves === 0 && styles.inputDisabled]}
                                        value={form.cantidadAves}
                                        onChangeText={(valor) => { setForm((actual) => ({ ...actual, cantidadAves: valor })); setErrorForm(''); }}
                                        keyboardType="number-pad"
                                        placeholder="Ej. 10"
                                        placeholderTextColor={COLORS.textSecondary}
                                        editable={ventaEditando?.cantidadAves !== 0}
                                    />
                                </View>
                                <View style={styles.column}>
                                    <Text style={styles.label}>Peso total (kg) *</Text>
                                    <TextInput style={styles.input} value={form.pesoKg} onChangeText={(valor) => { setForm((actual) => ({ ...actual, pesoKg: valor })); setErrorForm(''); }} keyboardType="decimal-pad" placeholder="Ej. 125.5" placeholderTextColor={COLORS.textSecondary} />
                                </View>
                            </View>
                            <View style={styles.field}>
                                <Text style={styles.label}>Precio por kg *</Text>
                                <TextInput style={styles.input} value={form.precioPorKg} onChangeText={(valor) => { setForm((actual) => ({ ...actual, precioPorKg: valor })); setErrorForm(''); }} keyboardType="decimal-pad" placeholder="Ej. 48.00" placeholderTextColor={COLORS.textSecondary} />
                            </View>
                            {campoFecha('Fecha de venta *', form.fecha, (valor) => setForm((actual) => ({ ...actual, fecha: valor })))}

                            <View style={styles.modeContainer}>
                                <TouchableOpacity style={[styles.modeButton, form.modalidad === 'contado' && styles.modeSelected]} onPress={() => setForm((actual) => ({ ...actual, modalidad: 'contado', abonoInicial: '' }))}>
                                    <Ionicons name="cash-outline" size={17} color={form.modalidad === 'contado' ? COLORS.primary : COLORS.textSecondary} />
                                    <Text style={[styles.modeText, form.modalidad === 'contado' && styles.modeTextSelected]}>Contado</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modeButton, form.modalidad === 'credito' && styles.modeSelected]} onPress={() => setForm((actual) => ({ ...actual, modalidad: 'credito' }))}>
                                    <Ionicons name="time-outline" size={17} color={form.modalidad === 'credito' ? COLORS.primary : COLORS.textSecondary} />
                                    <Text style={[styles.modeText, form.modalidad === 'credito' && styles.modeTextSelected]}>Crédito</Text>
                                </TouchableOpacity>
                            </View>

                            {form.modalidad === 'credito' ? (
                                <>
                                    {!ventaEditando ? (
                                        <View style={styles.field}>
                                            <Text style={styles.label}>Anticipo (opcional)</Text>
                                            <TextInput style={styles.input} value={form.abonoInicial} onChangeText={(valor) => setForm((actual) => ({ ...actual, abonoInicial: valor }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textSecondary} />
                                        </View>
                                    ) : null}
                                    {campoFecha('Fecha de vencimiento *', form.fechaVencimiento, (valor) => setForm((actual) => ({ ...actual, fechaVencimiento: valor })))}
                                </>
                            ) : null}

                            <View style={styles.calculation}>
                                <View style={styles.calcRow}><Text style={styles.calcLabel}>Importe ({formatNumber(pesoPreview)} kg)</Text><Text style={styles.calcValue}>{moneda(calculoPreview.totalVenta)}</Text></View>
                                <View style={styles.calcRow}><Text style={styles.calcLabel}>Costo operativo</Text><Text style={styles.calcValue}>{moneda(calculoPreview.costoOperacion)}</Text></View>
                                <View style={[styles.calcRow, styles.calcTotal]}><Text style={styles.calcProfitLabel}>Ganancia estimada</Text><Text style={styles.calcProfitValue}>{moneda(calculoPreview.ganancia)}</Text></View>
                            </View>
                            {ventaEditando ? (
                                <Text style={styles.rateHint}>Los pagos existentes se conservan. El nuevo total no puede ser menor a lo ya cobrado.</Text>
                            ) : form.modalidad === 'contado' ? <Text style={styles.rateHint}>El pago de contado se registra como liquidado por el total.</Text> : null}
                            {errorForm ? <Text style={styles.errorText}>{errorForm}</Text> : null}
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={cerrarModalVenta} disabled={guardando}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.primaryButton, guardando && styles.disabled]} onPress={() => void guardarVenta()} disabled={guardando}>
                                    {guardando ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                                    <Text style={styles.primaryButtonText}>{ventaEditando ? 'Guardar cambios' : 'Guardar venta'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={Boolean(modalSelector)} transparent animationType="fade" onRequestClose={() => setModalSelector(null)}>
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{modalSelector === 'cliente' ? 'Seleccionar cliente' : 'Seleccionar camada'}</Text>
                            <TouchableOpacity onPress={() => setModalSelector(null)} accessibilityLabel="Cerrar selector"><Ionicons name="close" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
                        </View>
                        <ScrollView style={styles.optionsList}>
                            {modalSelector === 'cliente' ? clientes.map((cliente) => (
                                <TouchableOpacity key={cliente.id} style={styles.option} onPress={() => { setForm((actual) => ({ ...actual, clienteId: cliente.id || '' })); setModalSelector(null); }}>
                                    <Text style={styles.optionName}>{cliente.nombre}</Text><Text style={styles.optionMeta}>{cliente.telefono || 'Sin teléfono'}</Text>
                                </TouchableOpacity>
                            )) : camadas.map((camada) => {
                                const sinStock = camada.avesDisponibles === null || camada.avesDisponibles <= 0;
                                return (
                                    <TouchableOpacity key={camada.id} disabled={sinStock} style={[styles.option, sinStock && styles.optionDisabled]} onPress={() => { setForm((actual) => ({ ...actual, camadaId: camada.id || '' })); setErrorForm(''); setModalSelector(null); }}>
                                        <Text style={[styles.optionName, sinStock && styles.optionNameDisabled]}>{camada.nombre}</Text>
                                        <Text style={styles.optionMeta}>
                                            {camada.avesDisponibles === null ? 'Aves sin configurar' : `${formatNumber(camada.avesDisponibles)} aves disponibles`}
                                            {' · '}Operación {moneda(camada.costoOperacionPorKg || 0)}/kg
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={Boolean(ventaAbonar)} transparent animationType="fade" onRequestClose={() => setVentaAbonar(null)}>
                <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Registrar abono</Text>
                            <TouchableOpacity onPress={() => setVentaAbonar(null)} accessibilityLabel="Cerrar abono"><Ionicons name="close" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
                        </View>
                        <Text style={styles.rateHint}>Saldo pendiente: {moneda(ventaAbonar?.saldoPendiente || 0)}</Text>
                        <Text style={styles.label}>Monto recibido *</Text>
                        <TextInput style={styles.input} value={montoAbono} onChangeText={setMontoAbono} keyboardType="decimal-pad" placeholder="Ej. 500.00" placeholderTextColor={COLORS.textSecondary} />
                        <Text style={styles.label}>Nota</Text>
                        <TextInput style={styles.input} value={notaAbono} onChangeText={setNotaAbono} placeholder="Referencia o comentario opcional" placeholderTextColor={COLORS.textSecondary} />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setVentaAbonar(null)} disabled={guardando}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.primaryButton, guardando && styles.disabled]} onPress={() => void guardarAbono()} disabled={guardando}>
                                {guardando ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cash-outline" size={17} color="#FFFFFF" />}
                                <Text style={styles.primaryButtonText}>Aplicar abono</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
    muted: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerCopy: { flex: 1, marginRight: 10 },
    heading: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '700' },
    subheading: { marginTop: 3, color: COLORS.textSecondary, fontSize: 13 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    primaryButton: { minHeight: 42, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.primary, borderRadius: 8 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    clientsButton: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card },
    clientsButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
    iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card },
    list: { flexGrow: 1, padding: 16, gap: 12 },
    summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, overflow: 'hidden', backgroundColor: COLORS.card },
    summaryItem: { minWidth: 105, flexGrow: 1, paddingHorizontal: 14, paddingVertical: 12, borderRightWidth: 1, borderColor: COLORS.border },
    summaryLabel: { color: COLORS.textSecondary, fontSize: 12 },
    summaryValue: { marginTop: 4, color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
    saleRow: { padding: 15, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    saleHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    saleTitleBlock: { flex: 1 },
    clientName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
    saleMeta: { marginTop: 4, color: COLORS.textSecondary, fontSize: 12 },
    status: { maxWidth: 150, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
    statusPaid: { backgroundColor: '#E8F5EE' },
    statusPartial: { backgroundColor: '#FFF4D8' },
    statusDue: { backgroundColor: '#FCE9E7' },
    statusText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '600' },
    saleFacts: { marginTop: 12, paddingVertical: 10, gap: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
    factText: { color: COLORS.textSecondary, fontSize: 13 },
    profit: { color: '#23804E' },
    saleFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    totalLabel: { color: COLORS.textSecondary, fontSize: 12 },
    totalValue: { marginTop: 2, color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
    dueDate: { marginTop: 3, color: COLORS.textSecondary, fontSize: 12 },
    paidText: { color: '#23804E', fontSize: 13, fontWeight: '600' },
    outstandingButton: { minHeight: 38, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 7 },
    outstandingText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
    paymentMeta: { marginTop: 8, color: COLORS.textSecondary, fontSize: 12 },
    saleActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: COLORS.border },
    saleActionButton: { minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7 },
    saleActionText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
    deleteSaleButton: { borderColor: '#F0CCCC', backgroundColor: '#FFF8F8' },
    deleteSaleText: { color: '#C43D3D', fontSize: 12, fontWeight: '600' },
    empty: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.48)' },
    modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
    modal: { width: '100%', maxWidth: 560, maxHeight: '92%', padding: 20, backgroundColor: COLORS.card, borderRadius: 10 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
    modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    label: { marginBottom: 7, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
    field: { marginBottom: 12 },
    input: { minHeight: 44, marginBottom: 13, paddingHorizontal: 12, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7 },
    inputDisabled: { backgroundColor: '#F1F3F5', color: COLORS.textSecondary },
    readOnlyValue: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 11, color: COLORS.textSecondary, backgroundColor: '#F1F3F5', borderRadius: 7 },
    selector: { minHeight: 44, marginBottom: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 7 },
    selectorText: { color: COLORS.textPrimary, fontSize: 14 },
    placeholder: { color: COLORS.textSecondary },
    rateHint: { marginTop: -6, marginBottom: 13, color: COLORS.textSecondary, fontSize: 12 },
    twoColumns: { flexDirection: 'row', gap: 10 },
    column: { flex: 1 },
    modeContainer: { flexDirection: 'row', gap: 8, marginBottom: 15 },
    modeButton: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7 },
    modeSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    modeText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
    modeTextSelected: { color: COLORS.primary },
    calculation: { padding: 12, marginBottom: 13, backgroundColor: '#F6F8FA', borderRadius: 7 },
    calcRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 5 },
    calcLabel: { color: COLORS.textSecondary, fontSize: 13 },
    calcValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
    calcTotal: { marginTop: 4, paddingTop: 9, borderTopWidth: 1, borderColor: COLORS.border },
    calcProfitLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
    calcProfitValue: { color: '#23804E', fontSize: 14, fontWeight: '700' },
    errorText: { marginBottom: 12, color: '#C53232', fontSize: 12 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    cancelButton: { minHeight: 42, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    cancelText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
    optionsList: { maxHeight: 360 },
    option: { paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.border },
    optionDisabled: { opacity: 0.55 },
    optionName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
    optionNameDisabled: { color: COLORS.textSecondary },
    optionMeta: { marginTop: 3, color: COLORS.textSecondary, fontSize: 12 },
    disabled: { opacity: 0.65 },
});
