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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { Cliente } from '../models/Cliente';
import {
    actualizarCliente,
    ClienteConVentasError,
    crearCliente,
    eliminarCliente,
    obtenerClientes,
} from '../services/ClienteService';
import { showAlert } from '../utils';

export const ClientesScreen: React.FC = () => {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [error, setError] = useState('');

    const cargarClientes = useCallback(async (refresco = false) => {
        if (refresco) setRefrescando(true);
        else setCargando(true);
        try {
            setClientes(await obtenerClientes());
        } catch (cargaError) {
            console.error('Error al cargar clientes:', cargaError);
            showAlert('Error', 'No se pudo cargar el registro de clientes.');
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    }, []);

    useEffect(() => {
        void cargarClientes();
    }, [cargarClientes]);

    const abrirCrear = () => {
        setClienteEditando(null);
        setNombre('');
        setTelefono('');
        setError('');
        setModalVisible(true);
    };

    const abrirEditar = (cliente: Cliente) => {
        setClienteEditando(cliente);
        setNombre(cliente.nombre);
        setTelefono(cliente.telefono);
        setError('');
        setModalVisible(true);
    };

    const guardar = async () => {
        const nombreLimpio = nombre.trim();
        if (nombreLimpio.length < 2) {
            setError('El nombre debe tener al menos 2 caracteres.');
            return;
        }
        try {
            setGuardando(true);
            const datos = { nombre: nombreLimpio, telefono: telefono.trim() };
            if (clienteEditando?.id) await actualizarCliente(clienteEditando.id, datos);
            else await crearCliente(datos);
            setModalVisible(false);
            await cargarClientes();
        } catch (guardarError) {
            console.error('Error al guardar cliente:', guardarError);
            setError(guardarError instanceof Error ? guardarError.message : 'No se pudo guardar el cliente.');
        } finally {
            setGuardando(false);
        }
    };

    const confirmarEliminacion = async (cliente: Cliente) => {
        if (!cliente.id) return;
        try {
            setGuardando(true);
            await eliminarCliente(cliente.id);
            await cargarClientes();
        } catch (deleteError) {
            if (deleteError instanceof ClienteConVentasError) {
                showAlert('Cliente con ventas', deleteError.message);
            } else {
                console.error('Error al eliminar cliente:', deleteError);
                showAlert('Error', 'No se pudo eliminar el cliente.');
            }
        } finally {
            setGuardando(false);
        }
    };

    const solicitarEliminacion = (cliente: Cliente) => {
        showAlert(
            'Eliminar cliente',
            `¿Eliminar a ${cliente.nombre}? Los clientes con ventas registradas se conservan para mantener el historial.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => void confirmarEliminacion(cliente) },
            ],
        );
    };

    if (cargando) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.muted}>Cargando clientes...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerCopy}>
                    <Text style={styles.heading}>Clientes</Text>
                    <Text style={styles.subheading}>{clientes.length} registrados</Text>
                </View>
                <View style={styles.headerActions}>
                    {Platform.OS === 'web' ? (
                        <TouchableOpacity style={styles.iconButton} onPress={() => void cargarClientes(true)} accessibilityLabel="Actualizar clientes">
                            <Ionicons name="refresh-outline" size={19} color={COLORS.primary} />
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.primaryButton} onPress={abrirCrear}>
                        <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryButtonText}>Nuevo cliente</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => void cargarClientes(true)} colors={[COLORS.primary]} />}
            >
                {clientes.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="people-outline" size={42} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTitle}>Sin clientes registrados</Text>
                        <Text style={styles.muted}>Agrega clientes para asociarlos a ventas de contado o crédito.</Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={abrirCrear}>
                            <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.primaryButtonText}>Registrar cliente</Text>
                        </TouchableOpacity>
                    </View>
                ) : clientes.map((cliente) => (
                    <View key={cliente.id} style={styles.clientRow}>
                        <View style={styles.personIcon}>
                            <Ionicons name="person-outline" size={19} color={COLORS.primary} />
                        </View>
                        <View style={styles.clientInfo}>
                            <Text style={styles.clientName}>{cliente.nombre}</Text>
                            <Text style={styles.clientPhone}>{cliente.telefono || 'Sin teléfono'}</Text>
                        </View>
                        <TouchableOpacity style={styles.iconButton} onPress={() => abrirEditar(cliente)} accessibilityLabel={`Editar ${cliente.nombre}`}>
                            <Ionicons name="pencil-outline" size={18} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconButton} onPress={() => solicitarEliminacion(cliente)} accessibilityLabel={`Eliminar ${cliente.nombre}`}>
                            <Ionicons name="trash-outline" size={18} color="#DC4C4C" />
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{clienteEditando ? 'Editar cliente' : 'Nuevo cliente'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} disabled={guardando} accessibilityLabel="Cerrar formulario">
                                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={[styles.input, error ? styles.inputError : null]} value={nombre} onChangeText={(valor) => { setNombre(valor); setError(''); }} placeholder="Nombre o razón social" placeholderTextColor={COLORS.textSecondary} autoFocus />
                        <Text style={styles.label}>Teléfono</Text>
                        <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="Teléfono de contacto (opcional)" placeholderTextColor={COLORS.textSecondary} keyboardType="phone-pad" />
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)} disabled={guardando}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.primaryButton, guardando && styles.disabled]} onPress={() => void guardar()} disabled={guardando}>
                                {guardando ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                                <Text style={styles.primaryButtonText}>{clienteEditando ? 'Guardar cambios' : 'Guardar cliente'}</Text>
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
    iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card },
    list: { flexGrow: 1, padding: 16, gap: 10 },
    clientRow: { minHeight: 72, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    personIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 8 },
    clientInfo: { flex: 1 },
    clientName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
    clientPhone: { marginTop: 4, color: COLORS.textSecondary, fontSize: 13 },
    empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.48)' },
    modal: { width: '100%', maxWidth: 480, padding: 20, backgroundColor: COLORS.card, borderRadius: 10 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    label: { marginBottom: 7, color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
    input: { minHeight: 44, marginBottom: 14, paddingHorizontal: 12, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7 },
    inputError: { borderColor: '#DC4C4C' },
    errorText: { marginTop: -7, marginBottom: 10, color: '#C53232', fontSize: 12 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 6 },
    cancelButton: { minHeight: 42, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    cancelText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
    disabled: { opacity: 0.65 },
});
