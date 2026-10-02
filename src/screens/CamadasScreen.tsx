import React, { useCallback, useEffect, useState } from 'react';
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
    useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { Camada, NuevaCamadaInput } from '../models/Camada';
import {
    calcularMetricasCamada,
    obtenerPollosVivos,
} from '../models/Camada';
import {
    actualizarCamada,
    CamadaConGastosError,
    CamadaConVentasError,
    crearCamada,
    eliminarCamada,
    obtenerTodasLasCamadas,
    registrarBajasCamada,
} from '../services/CamadaService';
import type { RootDrawerNavigationProp } from '../navigation/types';
import { formatCurrency, formatDate, parseDateInput, showAlert } from '../utils';

interface FormCamada {
    nombre: string;
    cantidadPollos: string;
    costoOperacionPorKg: string;
    fechaIngreso: string;
    fechaCambioAlimentoDesarrollo: string;
    fechaCambioAlimentoEngorde: string;
    fechaDesparasitacion: string;
}

type CampoCamada = keyof FormCamada;

const fechaAInput = (fecha?: Date | null): string => {
    return fecha ? formatDate(fecha) : '';
};

const fechaDesdeInput = parseDateInput;

const fechaInicial = (): string => fechaAInput(new Date());

const formularioVacio = (): FormCamada => ({
    nombre: '',
    cantidadPollos: '',
    costoOperacionPorKg: '',
    fechaIngreso: fechaInicial(),
    fechaCambioAlimentoDesarrollo: '',
    fechaCambioAlimentoEngorde: '',
    fechaDesparasitacion: '',
});

export const CamadasScreen: React.FC = () => {
    const navigation = useNavigation<RootDrawerNavigationProp<'Camadas'>>();
    const { width } = useWindowDimensions();
    const esAmplia = width >= 720;

    const [camadas, setCamadas] = useState<Camada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [camadaEditando, setCamadaEditando] = useState<Camada | null>(null);
    const [form, setForm] = useState<FormCamada>(formularioVacio);
    const [errores, setErrores] = useState<Partial<Record<CampoCamada, string>>>({});
    const [camadaBajas, setCamadaBajas] = useState<Camada | null>(null);
    const [cantidadBajas, setCantidadBajas] = useState('');

    const cargarCamadas = useCallback(async (refresco = false) => {
        if (refresco) setRefrescando(true);
        else setCargando(true);

        try {
            setCamadas(await obtenerTodasLasCamadas());
        } catch (error) {
            console.error('Error al cargar camadas:', error);
            showAlert('Error', 'No se pudieron cargar las camadas. Intenta de nuevo.');
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    }, []);

    useEffect(() => {
        void cargarCamadas();
    }, [cargarCamadas]);

    const abrirCrear = () => {
        setCamadaEditando(null);
        setForm(formularioVacio());
        setErrores({});
        setModalVisible(true);
    };

    const abrirEditar = (camada: Camada) => {
        setCamadaEditando(camada);
        setForm({
            nombre: camada.nombre,
            cantidadPollos: String(camada.cantidadPollos),
            costoOperacionPorKg: String(camada.costoOperacionPorKg || 0),
            fechaIngreso: fechaAInput(camada.fechaIngreso),
            fechaCambioAlimentoDesarrollo: fechaAInput(camada.fechaCambioAlimentoDesarrollo),
            fechaCambioAlimentoEngorde: fechaAInput(camada.fechaCambioAlimentoEngorde),
            fechaDesparasitacion: fechaAInput(camada.fechaDesparasitacion),
        });
        setErrores({});
        setModalVisible(true);
    };

    const validarFormulario = (): boolean => {
        const nuevosErrores: Partial<Record<CampoCamada, string>> = {};
        const nombre = form.nombre.trim();
        const cantidad = Number(form.cantidadPollos);
        const fechaIngreso = fechaDesdeInput(form.fechaIngreso);

        if (nombre.length < 3) {
            nuevosErrores.nombre = 'Escribe un nombre de al menos 3 caracteres.';
        }
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            nuevosErrores.cantidadPollos = 'Ingresa una cantidad entera mayor a cero.';
        } else if (camadaEditando && cantidad < camadaEditando.cantidadMuertes) {
            nuevosErrores.cantidadPollos =
                'La cantidad inicial no puede ser menor que las bajas registradas.';
        }
        const costoOperacionPorKg = Number(form.costoOperacionPorKg.replace(',', '.'));
        if (!form.costoOperacionPorKg || !Number.isFinite(costoOperacionPorKg) || costoOperacionPorKg < 0) {
            nuevosErrores.costoOperacionPorKg = 'Ingresa un costo por kg válido, igual o mayor a cero.';
        }
        if (!fechaIngreso) {
            nuevosErrores.fechaIngreso = 'Ingresa una fecha válida con formato dd-mm-yyyy.';
        }

        const fechasOpcionales: CampoCamada[] = [
            'fechaCambioAlimentoDesarrollo',
            'fechaCambioAlimentoEngorde',
            'fechaDesparasitacion',
        ];
        fechasOpcionales.forEach((campo) => {
            if (form[campo] && !fechaDesdeInput(form[campo])) {
                nuevosErrores[campo] = 'Usa el formato dd-mm-yyyy.';
            }
        });

        setErrores(nuevosErrores);
        return Object.keys(nuevosErrores).length === 0;
    };

    const guardarCamada = async () => {
        if (!validarFormulario()) return;

        const fechaIngreso = fechaDesdeInput(form.fechaIngreso);
        if (!fechaIngreso) return;

        const datos: NuevaCamadaInput = {
            nombre: form.nombre.trim(),
            cantidadPollos: Number(form.cantidadPollos),
            costoOperacionPorKg: Number(form.costoOperacionPorKg.replace(',', '.')),
            fechaIngreso,
            fechaCambioAlimentoDesarrollo: fechaDesdeInput(form.fechaCambioAlimentoDesarrollo),
            fechaCambioAlimentoEngorde: fechaDesdeInput(form.fechaCambioAlimentoEngorde),
            fechaDesparasitacion: fechaDesdeInput(form.fechaDesparasitacion),
        };

        try {
            setGuardando(true);
            if (camadaEditando?.id) {
                await actualizarCamada(camadaEditando.id, datos);
            } else {
                await crearCamada(datos);
            }
            setModalVisible(false);
            await cargarCamadas();
        } catch (error) {
            console.error('Error al guardar camada:', error);
            showAlert('Error', 'No se pudo guardar la camada. Revisa los datos e intenta de nuevo.');
        } finally {
            setGuardando(false);
        }
    };

    const guardarBajas = async () => {
        if (!camadaBajas?.id) return;
        const cantidad = Number(cantidadBajas);
        const avesVivas = obtenerPollosVivos(camadaBajas);
        if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > avesVivas) {
            showAlert('Cantidad no válida', `Ingresa un número entero entre 1 y ${avesVivas}.`);
            return;
        }

        try {
            setGuardando(true);
            await registrarBajasCamada(camadaBajas.id, cantidad);
            setCamadaBajas(null);
            setCantidadBajas('');
            await cargarCamadas();
        } catch (error) {
            console.error('Error al registrar bajas:', error);
            showAlert('Error', error instanceof Error ? error.message : 'No se pudieron registrar las bajas.');
        } finally {
            setGuardando(false);
        }
    };

    const cambiarEstado = async (camada: Camada) => {
        if (!camada.id) return;
        try {
            setGuardando(true);
            await actualizarCamada(camada.id, { activa: !camada.activa });
            await cargarCamadas();
        } catch (error) {
            console.error('Error al cambiar estado de camada:', error);
            showAlert('Error', 'No se pudo actualizar el estado de la camada.');
        } finally {
            setGuardando(false);
        }
    };

    const solicitarEliminacion = (camada: Camada) => {
        if (!camada.id) return;
        showAlert(
            'Eliminar camada',
            `¿Eliminar "${camada.nombre}"? Esta acción no se puede deshacer. Las camadas con gastos asociados no pueden eliminarse.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => void confirmarEliminacion(camada),
                },
            ],
        );
    };

    const confirmarEliminacion = async (camada: Camada) => {
        if (!camada.id) return;
        try {
            setGuardando(true);
            await eliminarCamada(camada.id);
            await cargarCamadas();
        } catch (error) {
            if (error instanceof CamadaConGastosError || error instanceof CamadaConVentasError) {
                showAlert('Camada con movimientos', error.message);
            } else {
                console.error('Error al eliminar camada:', error);
                showAlert('Error', 'No se pudo eliminar la camada.');
            }
        } finally {
            setGuardando(false);
        }
    };

    const abrirGastos = (camada: Camada) => {
        if (camada.id) navigation.navigate('Gastos', { camadaId: camada.id });
    };

    const actualizarCampo = (campo: CampoCamada, valor: string) => {
        setForm((actual) => ({ ...actual, [campo]: valor }));
        if (errores[campo]) setErrores((actual) => ({ ...actual, [campo]: undefined }));
    };

    const campoFecha = (
        campo: CampoCamada,
        etiqueta: string,
        obligatorio = false,
    ) => (
        <View style={styles.field}>
            <Text style={styles.label}>{etiqueta}{obligatorio ? ' *' : ''}</Text>
            <TextInput
                style={[styles.input, errores[campo] ? styles.inputError : null]}
                value={form[campo]}
                onChangeText={(valor) => actualizarCampo(campo, valor)}
                placeholder="dd-mm-yyyy"
                placeholderTextColor={COLORS.textSecondary}
                maxLength={10}
            />
            {errores[campo] ? <Text style={styles.errorText}>{errores[campo]}</Text> : null}
        </View>
    );

    const renderCamada = (camada: Camada) => {
        const metricas = calcularMetricasCamada(camada);
        return (
            <View key={camada.id || camada.nombre} style={styles.camadaRow}>
                <View style={styles.rowHeading}>
                    <View style={styles.titleBlock}>
                        <Text style={styles.camadaName}>{camada.nombre}</Text>
                        <Text style={styles.camadaMeta}>
                            Ingreso {formatDate(camada.fechaIngreso)} · {camada.cantidadPollos} aves iniciales
                        </Text>
                    </View>
                    <View style={[styles.status, camada.activa ? styles.statusActive : styles.statusClosed]}>
                        <Text style={[styles.statusText, camada.activa ? styles.statusActiveText : styles.statusClosedText]}>
                            {camada.activa ? 'Activa' : 'Finalizada'}
                        </Text>
                    </View>
                </View>

                <View style={styles.metrics}>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{metricas.pollosVivos}</Text>
                        <Text style={styles.metricLabel}>Aves vivas</Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{camada.cantidadMuertes}</Text>
                        <Text style={styles.metricLabel}>Bajas ({metricas.tasaMortalidad}%)</Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{formatCurrency(camada.totalGastos)}</Text>
                        <Text style={styles.metricLabel}>Gastos</Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{formatCurrency(metricas.costoPorPolloVivo)}</Text>
                        <Text style={styles.metricLabel}>Costo por ave viva</Text>
                    </View>
                </View>

                <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => abrirGastos(camada)}>
                        <Ionicons name="receipt-outline" size={17} color={COLORS.primary} />
                        <Text style={styles.actionPrimary}>Ver gastos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => camada.id && navigation.navigate('Ventas', { camadaId: camada.id })}
                    >
                        <Ionicons name="cart-outline" size={17} color={COLORS.primary} />
                        <Text style={styles.actionPrimary}>Ver ventas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => abrirEditar(camada)} accessibilityLabel="Editar camada">
                        <Ionicons name="pencil-outline" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                            setCamadaBajas(camada);
                            setCantidadBajas('');
                        }}
                        accessibilityLabel="Registrar bajas"
                    >
                        <Ionicons name="heart-dislike-outline" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => void cambiarEstado(camada)} accessibilityLabel={camada.activa ? 'Finalizar camada' : 'Reactivar camada'}>
                        <Ionicons name={camada.activa ? 'pause-circle-outline' : 'play-circle-outline'} size={19} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => solicitarEliminacion(camada)} accessibilityLabel="Eliminar camada">
                        <Ionicons name="trash-outline" size={18} color="#DC4C4C" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (cargando) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.mutedText}>Cargando camadas...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerCopy}>
                    <Text style={styles.heading}>Camadas</Text>
                    <Text style={styles.subheading}>{camadas.length} lotes registrados</Text>
                </View>
                <View style={styles.headerActions}>
                    {Platform.OS === 'web' ? (
                        <TouchableOpacity style={styles.refreshButton} onPress={() => void cargarCamadas(true)} accessibilityLabel="Actualizar camadas">
                            <Ionicons name="refresh-outline" size={19} color={COLORS.primary} />
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.createButton} onPress={abrirCrear}>
                        <Ionicons name="add" size={19} color="#FFFFFF" />
                        <Text style={styles.createButtonText}>Nueva camada</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={[styles.listContent, esAmplia && styles.listContentWide]}
                refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => void cargarCamadas(true)} colors={[COLORS.primary]} />}
            >
                {camadas.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="layers-outline" size={42} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTitle}>Aún no hay camadas</Text>
                        <Text style={styles.emptyDescription}>Registra tu primer lote para llevar el control de aves, bajas y gastos.</Text>
                        <TouchableOpacity style={styles.createButton} onPress={abrirCrear}>
                            <Ionicons name="add" size={19} color="#FFFFFF" />
                            <Text style={styles.createButtonText}>Registrar camada</Text>
                        </TouchableOpacity>
                    </View>
                ) : camadas.map(renderCamada)}
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{camadaEditando ? 'Editar camada' : 'Nueva camada'}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)} disabled={guardando} accessibilityLabel="Cerrar formulario">
                                    <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.field}>
                                <Text style={styles.label}>Nombre del lote *</Text>
                                <TextInput style={[styles.input, errores.nombre ? styles.inputError : null]} value={form.nombre} onChangeText={(valor) => actualizarCampo('nombre', valor)} placeholder="Ej. Camada Octubre" placeholderTextColor={COLORS.textSecondary} />
                                {errores.nombre ? <Text style={styles.errorText}>{errores.nombre}</Text> : null}
                            </View>
                            <View style={styles.field}>
                                <Text style={styles.label}>Aves iniciales *</Text>
                                <TextInput style={[styles.input, errores.cantidadPollos ? styles.inputError : null]} value={form.cantidadPollos} onChangeText={(valor) => actualizarCampo('cantidadPollos', valor)} keyboardType="number-pad" placeholder="Ej. 500" placeholderTextColor={COLORS.textSecondary} />
                                {errores.cantidadPollos ? <Text style={styles.errorText}>{errores.cantidadPollos}</Text> : null}
                            </View>
                            <View style={styles.field}>
                                <Text style={styles.label}>Costo de operación por kg *</Text>
                                <TextInput
                                    style={[styles.input, errores.costoOperacionPorKg ? styles.inputError : null]}
                                    value={form.costoOperacionPorKg}
                                    onChangeText={(valor) => actualizarCampo('costoOperacionPorKg', valor)}
                                    keyboardType="decimal-pad"
                                    placeholder="Ej. 18.50"
                                    placeholderTextColor={COLORS.textSecondary}
                                />
                                {errores.costoOperacionPorKg ? <Text style={styles.errorText}>{errores.costoOperacionPorKg}</Text> : null}
                            </View>
                            {campoFecha('fechaIngreso', 'Fecha de ingreso', true)}
                            <Text style={styles.sectionLabel}>Fechas de manejo (opcionales)</Text>
                            {campoFecha('fechaCambioAlimentoDesarrollo', 'Cambio a alimento de desarrollo')}
                            {campoFecha('fechaCambioAlimentoEngorde', 'Cambio a alimento de engorde')}
                            {campoFecha('fechaDesparasitacion', 'Desparasitación')}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)} disabled={guardando}>
                                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.createButton, guardando && styles.disabledButton]} onPress={() => void guardarCamada()} disabled={guardando}>
                                    {guardando ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                                    <Text style={styles.createButtonText}>{camadaEditando ? 'Guardar cambios' : 'Crear camada'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={Boolean(camadaBajas)} transparent animationType="fade" onRequestClose={() => setCamadaBajas(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Registrar bajas</Text>
                            <TouchableOpacity onPress={() => setCamadaBajas(null)} accessibilityLabel="Cerrar registro de bajas">
                                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalDescription}>
                            {camadaBajas?.nombre}: {camadaBajas ? obtenerPollosVivos(camadaBajas) : 0} aves vivas disponibles.
                        </Text>
                        <Text style={styles.label}>Cantidad de aves fallecidas</Text>
                        <TextInput style={styles.input} value={cantidadBajas} onChangeText={setCantidadBajas} keyboardType="number-pad" placeholder="Ej. 2" placeholderTextColor={COLORS.textSecondary} />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setCamadaBajas(null)} disabled={guardando}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.createButton, guardando && styles.disabledButton]} onPress={() => void guardarBajas()} disabled={guardando}>
                                {guardando ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                                <Text style={styles.createButtonText}>Registrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
    mutedText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 14 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerCopy: { flex: 1, marginRight: 12 },
    heading: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '700' },
    subheading: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    createButton: { minHeight: 42, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.primary, borderRadius: 8 },
    createButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    refreshButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    listContent: { padding: 16, gap: 12, flexGrow: 1 },
    listContentWide: { alignSelf: 'center', width: '100%', maxWidth: 1040 },
    camadaRow: { padding: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    rowHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    titleBlock: { flex: 1 },
    camadaName: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
    camadaMeta: { marginTop: 4, fontSize: 12, color: COLORS.textSecondary },
    status: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
    statusActive: { backgroundColor: '#E8F5EE' },
    statusClosed: { backgroundColor: '#F1F3F5' },
    statusText: { fontSize: 12, fontWeight: '600' },
    statusActiveText: { color: '#247A4B' },
    statusClosedText: { color: COLORS.textSecondary },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 16, marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
    metric: { minWidth: 105, flexGrow: 1 },
    metricValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
    metricLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
    rowActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
    actionButton: { minHeight: 36, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7 },
    actionPrimary: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
    iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 7 },
    emptyState: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 28 },
    emptyTitle: { marginTop: 14, color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    emptyDescription: { maxWidth: 340, marginTop: 6, marginBottom: 18, color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.48)' },
    modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
    modalContent: { width: '100%', maxWidth: 520, padding: 20, backgroundColor: COLORS.card, borderRadius: 10 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    modalDescription: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 18 },
    sectionLabel: { marginTop: 8, marginBottom: 12, color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
    field: { marginBottom: 14 },
    label: { marginBottom: 7, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
    input: { minHeight: 44, paddingHorizontal: 12, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: '#FFFFFF' },
    inputError: { borderColor: '#DC4C4C' },
    errorText: { marginTop: 5, color: '#C53232', fontSize: 12 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    cancelButton: { minHeight: 42, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    cancelButtonText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
    disabledButton: { opacity: 0.65 },
});