import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import {
    calcularMetricasCamada,
    obtenerPollosVivos,
    type Camada,
} from '../models/Camada';
import type { Cliente } from '../models/Cliente';
import type { Gasto } from '../models/Gasto';
import type { TipoGasto } from '../models/TipoGasto';
import type { Venta } from '../models/Venta';
import type { IAlertaCamada } from '../services/CamadaService';
import {
    obtenerAlertasProximasCamadas,
    obtenerTodasLasCamadas,
} from '../services/CamadaService';
import { obtenerClientes } from '../services/ClienteService';
import { obtenerTodosLosGastos } from '../services/GastoService';
import { obtenerTiposGasto } from '../services/TipoGastoService';
import { obtenerVentas } from '../services/VentaService';
import { formatCurrency, formatDate, formatNumber } from '../utils';
import type { RootDrawerNavigationProp } from '../navigation/types';

type Periodo = '30d' | 'todo';

interface DatosTablero {
    camadas: Camada[];
    clientes: Cliente[];
    gastos: Gasto[];
    tipos: TipoGasto[];
    ventas: Venta[];
    alertas: IAlertaCamada[];
}

const DATOS_VACIOS: DatosTablero = {
    camadas: [],
    clientes: [],
    gastos: [],
    tipos: [],
    ventas: [],
    alertas: [],
};

const PALETA = ['#17835D', '#C2782D', '#3277A8', '#B44949', '#6872A5'];

const valorPeriodo = (fecha: Date, periodo: Periodo): boolean => {
    if (periodo === 'todo') return true;
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
    inicio.setHours(0, 0, 0, 0);
    return fecha >= inicio;
};

export const HomeScreen: React.FC = () => {
    const navigation = useNavigation<RootDrawerNavigationProp<'Home'>>();
    const { width } = useWindowDimensions();
    const amplia = width >= 900;
    const [datos, setDatos] = useState<DatosTablero>(DATOS_VACIOS);
    const [periodo, setPeriodo] = useState<Periodo>('30d');
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [errorCarga, setErrorCarga] = useState(false);

    const cargarDatos = useCallback(async (refrescar = false) => {
        if (refrescar) setRefrescando(true);
        else setCargando(true);
        setErrorCarga(false);

        try {
            const [camadas, clientes, gastos, tipos, ventas, alertas] = await Promise.all([
                obtenerTodasLasCamadas(),
                obtenerClientes(),
                obtenerTodosLosGastos(),
                obtenerTiposGasto(),
                obtenerVentas(),
                obtenerAlertasProximasCamadas(7),
            ]);
            setDatos({ camadas, clientes, gastos, tipos, ventas, alertas });
        } catch (error) {
            console.error('Error al cargar el dashboard:', error);
            setErrorCarga(true);
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    }, []);

    useEffect(() => {
        void cargarDatos();
    }, [cargarDatos]);

    const resumen = useMemo(() => {
        const ventasPeriodo = datos.ventas.filter((venta) => valorPeriodo(venta.fecha, periodo));
        const gastosPeriodo = datos.gastos.filter((gasto) => valorPeriodo(gasto.fecha, periodo));
        const camadasActivas = datos.camadas.filter((camada) => camada.activa);
        const ventasPorCobrar = datos.ventas.filter((venta) => venta.saldoPendiente > 0);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const ventasVencidas = ventasPorCobrar.filter(
            (venta) => venta.fechaVencimiento && venta.fechaVencimiento < hoy,
        );

        const totalVendido = ventasPeriodo.reduce((total, venta) => total + venta.totalVenta, 0);
        const costoOperacion = ventasPeriodo.reduce((total, venta) => total + venta.costoOperacion, 0);
        const ganancia = ventasPeriodo.reduce((total, venta) => total + venta.ganancia, 0);
        const pesoVendido = ventasPeriodo.reduce((total, venta) => total + venta.pesoKg, 0);
        const totalGastos = gastosPeriodo.reduce((total, gasto) => total + gasto.precio, 0);
        const pollosIniciales = camadasActivas.reduce((total, camada) => total + camada.cantidadPollos, 0);
        const pollosVivos = camadasActivas.reduce((total, camada) => total + obtenerPollosVivos(camada), 0);
        const muertes = camadasActivas.reduce((total, camada) => total + camada.cantidadMuertes, 0);
        const mortalidad = pollosIniciales > 0 ? (muertes / pollosIniciales) * 100 : 0;

        const tiposPorId = new Map(datos.tipos.map((tipo) => [tipo.id || '', tipo.nombre]));
        const gastoPorTipo = new Map<string, number>();
        gastosPeriodo.forEach((gasto) => {
            const nombre = tiposPorId.get(gasto.tipoGastoId) || gasto.tipoGastoNombre || 'Otros';
            gastoPorTipo.set(nombre, (gastoPorTipo.get(nombre) || 0) + gasto.precio);
        });

        const ventasPorCliente = new Map<string, { nombre: string; total: number; saldo: number }>();
        datos.ventas.forEach((venta) => {
            const actual = ventasPorCliente.get(venta.clienteId) || {
                nombre: venta.clienteNombre,
                total: 0,
                saldo: 0,
            };
            actual.total += venta.totalVenta;
            actual.saldo += venta.saldoPendiente;
            ventasPorCliente.set(venta.clienteId, actual);
        });

        const clientePorId = new Map(datos.clientes.map((cliente) => [cliente.id || '', cliente.nombre]));
        const mejoresClientes = [...ventasPorCliente.entries()]
            .map(([clienteId, cliente]) => ({
                ...cliente,
                nombre: clientePorId.get(clienteId) || cliente.nombre,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 4);

        const camadaCritica = [...camadasActivas]
            .map((camada) => ({ camada, metricas: calcularMetricasCamada(camada) }))
            .sort((a, b) => b.metricas.tasaMortalidad - a.metricas.tasaMortalidad)[0];

        return {
            ventasPeriodo,
            gastosPeriodo,
            camadasActivas,
            ventasPorCobrar,
            ventasVencidas,
            totalVendido,
            costoOperacion,
            ganancia,
            pesoVendido,
            ventasSinCostoOperacion: ventasPeriodo.filter((venta) => venta.costoOperacionPorKg <= 0).length,
            totalGastos,
            pollosIniciales,
            pollosVivos,
            mortalidad,
            saldoPendiente: ventasPorCobrar.reduce((total, venta) => total + venta.saldoPendiente, 0),
            saldoVencido: ventasVencidas.reduce((total, venta) => total + venta.saldoPendiente, 0),
            gastoPorTipo: [...gastoPorTipo.entries()]
                .map(([nombre, total]) => ({ nombre, total }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 5),
            mejoresClientes,
            camadaCritica,
        };
    }, [datos, periodo]);

    if (cargando) {
        return (
            <View style={styles.cargando}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.textoSecundario}>Preparando indicadores...</Text>
            </View>
        );
    }

    const periodoTexto = periodo === '30d' ? 'Últimos 30 días' : 'Todo el historial';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contenido}
            refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => void cargarDatos(true)} colors={[COLORS.primary]} />}
        >
            <View style={styles.topBar}>
                <View>
                    <Text style={styles.saludo}>Panel de gestión</Text>
                    <Text style={styles.fechaActual}>{formatDate(new Date())}</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={() => void cargarDatos(true)} accessibilityLabel="Actualizar tablero">
                    <Ionicons name="refresh-outline" size={19} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.titleRow}>
                <View style={styles.titleCopy}>
                    <Text style={styles.titulo}>Resumen de la granja</Text>
                    <Text style={styles.bajada}>Producción, rentabilidad y cartera en un solo lugar</Text>
                </View>
                <View style={styles.periodoControl}>
                    {(['30d', 'todo'] as Periodo[]).map((opcion) => (
                        <TouchableOpacity
                            key={opcion}
                            onPress={() => setPeriodo(opcion)}
                            style={[styles.periodoButton, periodo === opcion && styles.periodoActivo]}
                        >
                            <Text style={[styles.periodoTexto, periodo === opcion && styles.periodoTextoActivo]}>
                                {opcion === '30d' ? '30 días' : 'Todo'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {errorCarga ? (
                <View style={styles.errorBanner}>
                    <Ionicons name="cloud-offline-outline" size={18} color="#9D3C35" />
                    <Text style={styles.errorTexto}>No se pudieron cargar todos los indicadores. Actualiza para reintentar.</Text>
                </View>
            ) : null}
            {resumen.ventasSinCostoOperacion > 0 ? (
                <TouchableOpacity style={styles.warningBanner} onPress={() => navigation.navigate('Camadas')}>
                    <Ionicons name="warning-outline" size={18} color="#8A5B16" />
                    <Text style={styles.warningText}>
                        {resumen.ventasSinCostoOperacion} ventas no tienen costo operativo por kg configurado; el margen puede estar sobreestimado.
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#8A5B16" />
                </TouchableOpacity>
            ) : null}

            <View style={styles.kpiGrid}>
                <Kpi
                    label="Ventas"
                    value={formatCurrency(resumen.totalVendido)}
                    detail={`${resumen.ventasPeriodo.length} operaciones · ${formatNumber(resumen.pesoVendido)} kg`}
                    icon="trending-up-outline"
                    accent="#176B4D"
                    wide={amplia}
                />
                <Kpi
                    label="Ganancia de ventas"
                    value={formatCurrency(resumen.ganancia)}
                    detail={resumen.ventasSinCostoOperacion
                        ? `${resumen.ventasSinCostoOperacion} ventas sin costo operativo/kg configurado`
                        : `Margen ${resumen.totalVendido ? ((resumen.ganancia / resumen.totalVendido) * 100).toFixed(1) : '0.0'}% · después de operación/kg`}
                    icon="analytics-outline"
                    accent="#287A58"
                    wide={amplia}
                />
                <Kpi
                    label="Gastos registrados"
                    value={formatCurrency(resumen.totalGastos)}
                    detail={`${resumen.gastosPeriodo.length} compras · ${periodoTexto.toLowerCase()}`}
                    icon="receipt-outline"
                    accent="#A35C25"
                    wide={amplia}
                />
                <Kpi
                    label="Por cobrar"
                    value={formatCurrency(resumen.saldoPendiente)}
                    detail={`${resumen.ventasPorCobrar.length} créditos · ${formatCurrency(resumen.saldoVencido)} vencidos`}
                    icon="time-outline"
                    accent={resumen.saldoVencido > 0 ? '#A5443F' : '#356A8A'}
                    wide={amplia}
                    onPress={() => navigation.navigate('Ventas')}
                />
            </View>

            <View style={[styles.sectionGrid, amplia && styles.sectionGridWide]}>
                <View style={[styles.section, amplia && styles.sectionHalf]}>
                    <SectionHeader title="Operación" subtitle="Estado de camadas activas" />
                    <View style={styles.metricStrip}>
                        <MiniMetric value={String(resumen.camadasActivas.length)} label="Camadas" />
                        <MiniMetric value={formatNumber(resumen.pollosVivos)} label="Aves vivas" />
                        <MiniMetric value={`${resumen.mortalidad.toFixed(1)}%`} label="Mortalidad" />
                    </View>
                    {resumen.camadaCritica ? (
                        <TouchableOpacity
                            style={styles.decisionLine}
                            onPress={() => navigation.navigate('Camadas')}
                        >
                            <View style={styles.decisionIcon}><Ionicons name="pulse-outline" size={17} color="#A35C25" /></View>
                            <View style={styles.decisionCopy}>
                                <Text style={styles.decisionTitle}>Mayor mortalidad</Text>
                                <Text style={styles.decisionDescription}>
                                    {resumen.camadaCritica.camada.nombre} · {resumen.camadaCritica.metricas.tasaMortalidad}%
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={17} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.vacioInline}>No hay camadas activas para evaluar.</Text>
                    )}
                    <View style={styles.sectionFooter}>
                        <Text style={styles.costoLabel}>Costo de operación vendido</Text>
                        <Text style={styles.costoValue}>{formatCurrency(resumen.costoOperacion)}</Text>
                    </View>
                </View>

                <View style={[styles.section, amplia && styles.sectionHalf]}>
                    <SectionHeader title="Gastos por categoría" subtitle={periodoTexto} />
                    {resumen.gastoPorTipo.length ? resumen.gastoPorTipo.map((item, index) => {
                        const porcentaje = resumen.totalGastos > 0 ? item.total / resumen.totalGastos : 0;
                        return (
                            <View key={item.nombre} style={styles.categoryRow}>
                                <View style={styles.categoryTop}>
                                    <View style={styles.categoryNameWrap}>
                                        <View style={[styles.dot, { backgroundColor: PALETA[index % PALETA.length] }]} />
                                        <Text style={styles.categoryName} numberOfLines={1}>{item.nombre}</Text>
                                    </View>
                                    <Text style={styles.categoryAmount}>{formatCurrency(item.total)}</Text>
                                </View>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { width: `${Math.max(porcentaje * 100, 2)}%`, backgroundColor: PALETA[index % PALETA.length] }]} />
                                </View>
                            </View>
                        );
                    }) : <Text style={styles.vacioInline}>No hay gastos en este período.</Text>}
                    <TouchableOpacity style={styles.textAction} onPress={() => navigation.navigate('Gastos')}>
                        <Text style={styles.textActionLabel}>Abrir gastos</Text>
                        <Ionicons name="arrow-forward" size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.sectionGrid, amplia && styles.sectionGridWide]}>
                <View style={[styles.section, amplia && styles.sectionHalf]}>
                    <SectionHeader title="Cartera de crédito" subtitle="Seguimiento de cobros pendientes" />
                    {resumen.ventasVencidas.length ? (
                        <View style={styles.alertBanner}>
                            <Ionicons name="alert-circle-outline" size={19} color="#A5443F" />
                            <View style={styles.alertCopy}>
                                <Text style={styles.alertTitle}>{formatCurrency(resumen.saldoVencido)} vencidos</Text>
                                <Text style={styles.alertText}>{resumen.ventasVencidas.length} ventas requieren seguimiento</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.clearBanner}>
                            <Ionicons name="checkmark-circle-outline" size={19} color="#287A58" />
                            <Text style={styles.clearText}>Sin saldos vencidos</Text>
                        </View>
                    )}
                    {resumen.ventasPorCobrar.slice(0, 3).map((venta) => (
                        <View key={venta.id} style={styles.receivableRow}>
                            <View style={styles.decisionCopy}>
                                <Text style={styles.receivableName}>{venta.clienteNombre}</Text>
                                <Text style={styles.receivableMeta}>
                                    {venta.fechaVencimiento ? `Vence ${formatDate(venta.fechaVencimiento)}` : 'Sin vencimiento'}
                                </Text>
                            </View>
                            <Text style={styles.receivableAmount}>{formatCurrency(venta.saldoPendiente)}</Text>
                        </View>
                    ))}
                    {!resumen.ventasPorCobrar.length ? <Text style={styles.vacioInline}>No hay cuentas pendientes.</Text> : null}
                    <TouchableOpacity style={styles.textAction} onPress={() => navigation.navigate('Ventas')}>
                        <Text style={styles.textActionLabel}>Gestionar ventas</Text>
                        <Ionicons name="arrow-forward" size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, amplia && styles.sectionHalf]}>
                    <SectionHeader title="Clientes principales" subtitle="Por monto de ventas acumulado" />
                    {resumen.mejoresClientes.length ? resumen.mejoresClientes.map((cliente, index) => (
                        <View key={`${cliente.nombre}-${index}`} style={styles.customerRow}>
                            <Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text>
                            <View style={styles.decisionCopy}>
                                <Text style={styles.receivableName} numberOfLines={1}>{cliente.nombre}</Text>
                                <Text style={styles.receivableMeta}>Saldo {formatCurrency(cliente.saldo)}</Text>
                            </View>
                            <Text style={styles.receivableAmount}>{formatCurrency(cliente.total)}</Text>
                        </View>
                    )) : <Text style={styles.vacioInline}>Registra ventas para ver clientes principales.</Text>}
                    <TouchableOpacity style={styles.textAction} onPress={() => navigation.navigate('Clientes')}>
                        <Text style={styles.textActionLabel}>Abrir clientes</Text>
                        <Ionicons name="arrow-forward" size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.section}>
                <SectionHeader title="Próximas tareas" subtitle="Fechas de manejo en los siguientes 7 días" />
                {datos.alertas.length ? datos.alertas.slice(0, 4).map((alerta, index) => (
                    <View key={`${alerta.camadaId}-${alerta.tipoAlerta}-${index}`} style={styles.taskRow}>
                        <View style={[styles.taskDate, alerta.diasRestantes === 0 && styles.taskDateToday]}>
                            <Text style={styles.taskDays}>{alerta.diasRestantes === 0 ? 'HOY' : `${alerta.diasRestantes}d`}</Text>
                        </View>
                        <View style={styles.decisionCopy}>
                            <Text style={styles.receivableName}>{alerta.tipoAlerta}</Text>
                            <Text style={styles.receivableMeta}>{alerta.camadaNombre} · {formatDate(alerta.fecha)}</Text>
                        </View>
                        <Ionicons name="calendar-outline" size={17} color={COLORS.textSecondary} />
                    </View>
                )) : <Text style={styles.vacioInline}>No hay tareas programadas para los próximos 7 días.</Text>}
            </View>

            <View style={styles.noteLine}>
                <Ionicons name="information-circle-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.noteText}>La ganancia de ventas descuenta el costo operativo por kg. Los gastos de camada se muestran aparte y no se restan otra vez.</Text>
            </View>
        </ScrollView>
    );
};

interface KpiProps {
    label: string;
    value: string;
    detail: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    accent: string;
    wide: boolean;
    onPress?: () => void;
}

const Kpi: React.FC<KpiProps> = ({ label, value, detail, icon, accent, wide, onPress }) => {
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
        <Wrapper style={[styles.kpi, wide && styles.kpiWide]} onPress={onPress}>
            <View style={styles.kpiTop}>
                <Text style={styles.kpiLabel}>{label}</Text>
                <Ionicons name={icon} size={19} color={accent} />
            </View>
            <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={styles.kpiDetail}>{detail}</Text>
        </Wrapper>
    );
};

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
);

const MiniMetric: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <View style={styles.miniMetric}>
        <Text style={styles.miniValue}>{value}</Text>
        <Text style={styles.miniLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F6F4' },
    contenido: { paddingHorizontal: 20, paddingBottom: 34, gap: 16 },
    cargando: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6F4' },
    textoSecundario: { marginTop: 12, color: COLORS.textSecondary, fontSize: 14 },
    topBar: { minHeight: 48, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    saludo: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
    fechaActual: { marginTop: 3, color: COLORS.textSecondary, fontSize: 12 },
    refreshButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card },
    titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 3 },
    titleCopy: { flex: 1, minWidth: 240 },
    titulo: { color: '#1D342C', fontSize: 25, fontWeight: '800' },
    bajada: { marginTop: 5, color: COLORS.textSecondary, fontSize: 13 },
    periodoControl: { flexDirection: 'row', padding: 3, backgroundColor: '#E7ECE8', borderRadius: 8 },
    periodoButton: { minWidth: 72, minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 6 },
    periodoActivo: { backgroundColor: COLORS.card },
    periodoTexto: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
    periodoTextoActivo: { color: COLORS.textPrimary },
    errorBanner: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FAE9E7', borderRadius: 7 },
    errorTexto: { flex: 1, color: '#853B36', fontSize: 12 },
    warningBanner: { minHeight: 48, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F7EFDF', borderRadius: 7 },
    warningText: { flex: 1, color: '#75521E', fontSize: 12, lineHeight: 17 },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    kpi: { flexBasis: '48%', flexGrow: 1, minWidth: 145, minHeight: 116, padding: 13, backgroundColor: COLORS.card, borderWidth: 1, borderColor: '#DFE6E1', borderRadius: 8 },
    kpiWide: { flexBasis: '23%' },
    kpiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
    kpiLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
    kpiValue: { marginTop: 11, color: '#1D342C', fontSize: 23, fontWeight: '800' },
    kpiDetail: { marginTop: 4, color: COLORS.textSecondary, fontSize: 11, lineHeight: 15 },
    sectionGrid: { gap: 14 },
    sectionGridWide: { flexDirection: 'row', alignItems: 'stretch' },
    section: { padding: 15, backgroundColor: COLORS.card, borderWidth: 1, borderColor: '#DFE6E1', borderRadius: 8 },
    sectionHalf: { flex: 1 },
    sectionHeader: { marginBottom: 14 },
    sectionTitle: { color: '#1D342C', fontSize: 16, fontWeight: '700' },
    sectionSubtitle: { marginTop: 4, color: COLORS.textSecondary, fontSize: 12 },
    metricStrip: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
    miniMetric: { flex: 1 },
    miniValue: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    miniLabel: { marginTop: 3, color: COLORS.textSecondary, fontSize: 11 },
    decisionLine: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
    decisionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6EDDF', borderRadius: 7 },
    decisionCopy: { flex: 1 },
    decisionTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
    decisionDescription: { marginTop: 3, color: COLORS.textSecondary, fontSize: 12 },
    sectionFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 11, marginTop: 4, borderTopWidth: 1, borderColor: COLORS.border },
    costoLabel: { color: COLORS.textSecondary, fontSize: 12 },
    costoValue: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
    categoryRow: { marginBottom: 12 },
    categoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
    categoryNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    categoryName: { flex: 1, color: COLORS.textPrimary, fontSize: 12 },
    categoryAmount: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
    barTrack: { height: 5, overflow: 'hidden', backgroundColor: '#EDF0EE', borderRadius: 3 },
    barFill: { height: 5, borderRadius: 3 },
    textAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 5 },
    textActionLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
    alertBanner: { minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FAE9E7', borderRadius: 7 },
    alertCopy: { flex: 1 },
    alertTitle: { color: '#853B36', fontSize: 13, fontWeight: '700' },
    alertText: { marginTop: 3, color: '#853B36', fontSize: 11 },
    clearBanner: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8F3EC', borderRadius: 7 },
    clearText: { color: '#286144', fontSize: 12, fontWeight: '600' },
    receivableRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: '#EDF0EE' },
    receivableName: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
    receivableMeta: { marginTop: 3, color: COLORS.textSecondary, fontSize: 11 },
    receivableAmount: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
    customerRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: '#EDF0EE' },
    rank: { width: 25, color: '#718078', fontSize: 11, fontWeight: '700' },
    taskRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: '#EDF0EE' },
    taskDate: { width: 42, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF0EC', borderRadius: 6 },
    taskDateToday: { backgroundColor: '#F6E8D8' },
    taskDays: { color: '#365A48', fontSize: 11, fontWeight: '700' },
    vacioInline: { paddingVertical: 13, color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
    noteLine: { paddingHorizontal: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
    noteText: { flex: 1, color: COLORS.textSecondary, fontSize: 11, lineHeight: 16 },
});