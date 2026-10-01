import React, { useState, useEffect, useCallback } from 'react';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  ScrollView,
  FlatList,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { Camada } from '../models/Camada';
import type { Gasto, NuevoGastoInput } from '../models/Gasto';
import type { TipoGasto } from '../models/TipoGasto';
import {
  obtenerCamadasActivas,
  obtenerTodasLasCamadas,
} from '../services/CamadaService';
import {
  obtenerGastosPorCamada,
  crearGasto,
  eliminarGasto,
  obtenerResumenGastosPorCategoria,
  type IResumenCategoria,
} from '../services/GastoService';
import { obtenerTiposGasto } from '../services/TipoGastoService';
import { showAlert } from '../utils';
import type { RootDrawerParamList } from '../navigation/types';

const isWeb = Platform.OS === 'web';

// ─────────────────────────────────────────────────────────
// Utilitarios de formato
// ─────────────────────────────────────────────────────────
const formatFecha = (fecha: Date): string => {
  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatMoneda = (valor: number): string => {
  return `$${valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const dateToInputValue = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const inputValueToDate = (value: string): Date | null => {
  if (!value) return null;
  const d = new Date(value + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
};

// ─────────────────────────────────────────────────────────
// Estado inicial del formulario
// ─────────────────────────────────────────────────────────
interface FormGasto {
  tipoGastoId: string;
  tipoGastoNombre: string;
  precio: string;
  proveedor: string;
  fecha: string; // YYYY-MM-DD string para el input
}

const FORM_INICIAL: FormGasto = {
  tipoGastoId: '',
  tipoGastoNombre: '',
  precio: '',
  proveedor: '',
  fecha: dateToInputValue(new Date()),
};

// ─────────────────────────────────────────────────────────
// Colores por categoría (cíclico)
// ─────────────────────────────────────────────────────────
const PALETA_CATEGORIAS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
];
const colorCategoria = (index: number) =>
  PALETA_CATEGORIAS[index % PALETA_CATEGORIAS.length];

// ─────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────
export const GastosScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootDrawerParamList, 'Gastos'>>();
  const camadaIdSolicitada = route.params?.camadaId;
  const { width } = useWindowDimensions();
  const isWide = width >= 640;

  // ── Datos maestros ──────────────────────────────────────
  const [camadas, setCamadas] = useState<Camada[]>([]);
  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);

  // ── Selección actual ────────────────────────────────────
  const [camadaSeleccionada, setCamadaSeleccionada] = useState<Camada | null>(null);

  // ── Gastos y resumen ────────────────────────────────────
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<IResumenCategoria[]>([]);

  // ── Estado de UI ────────────────────────────────────────
  const [cargando, setCargando] = useState(true);
  const [cargandoGastos, setCargandoGastos] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // ── Modales ─────────────────────────────────────────────
  const [modalCamadaVisible, setModalCamadaVisible] = useState(false);
  const [modalFormVisible, setModalFormVisible] = useState(false);
  const [modalTipoVisible, setModalTipoVisible] = useState(false);
  const [confirmEliminarVisible, setConfirmEliminarVisible] = useState(false);
  const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null);

  // ── Formulario ──────────────────────────────────────────
  const [form, setForm] = useState<FormGasto>(FORM_INICIAL);
  const [errores, setErrores] = useState<Partial<FormGasto>>({});

  // ═══════════════════════════════════════════════════════
  // Carga inicial: camadas y tipos de gasto
  // ═══════════════════════════════════════════════════════
  const cargarDatosMaestros = useCallback(async () => {
    try {
      const [todasCamadas, tipos] = await Promise.all([
        obtenerTodasLasCamadas(),
        obtenerTiposGasto(),
      ]);
      setCamadas(todasCamadas);
      setTiposGasto(tipos);

      // Seleccionar automáticamente la primera camada activa
      const activa = todasCamadas.find((c) => c.activa);
      if (activa && !camadaSeleccionada) {
        setCamadaSeleccionada(activa);
      }
    } catch (error) {
      console.error('Error al cargar datos maestros:', error);
      showAlert('Error', 'No se pudieron cargar las camadas o tipos de gasto.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatosMaestros();
  }, [cargarDatosMaestros]);

  useEffect(() => {
    if (!camadaIdSolicitada) return;
    const camada = camadas.find((item) => item.id === camadaIdSolicitada);
    if (camada) setCamadaSeleccionada(camada);
  }, [camadaIdSolicitada, camadas]);

  // ═══════════════════════════════════════════════════════
  // Carga de gastos cuando cambia la camada seleccionada
  // ═══════════════════════════════════════════════════════
  const cargarGastos = useCallback(async (camadaId: string) => {
    setCargandoGastos(true);
    try {
      const [gastosData, resumenData] = await Promise.all([
        obtenerGastosPorCamada(camadaId),
        obtenerResumenGastosPorCategoria(camadaId),
      ]);
      setGastos(gastosData);
      setResumen(resumenData);
    } catch (error) {
      console.error('Error al cargar gastos:', error);
      showAlert('Error', 'No se pudieron cargar los gastos de la camada.');
    } finally {
      setCargandoGastos(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    if (camadaSeleccionada?.id) {
      cargarGastos(camadaSeleccionada.id);
    } else {
      setGastos([]);
      setResumen([]);
    }
  }, [camadaSeleccionada, cargarGastos]);

  const onRefresh = () => {
    if (!camadaSeleccionada?.id) return;
    setRefrescando(true);
    cargarGastos(camadaSeleccionada.id);
  };

  // ═══════════════════════════════════════════════════════
  // Selección de camada
  // ═══════════════════════════════════════════════════════
  const seleccionarCamada = (camada: Camada) => {
    setCamadaSeleccionada(camada);
    setModalCamadaVisible(false);
  };

  // ═══════════════════════════════════════════════════════
  // Validaciones del formulario
  // ═══════════════════════════════════════════════════════
  const validarForm = (): boolean => {
    const nuevosErrores: Partial<FormGasto> = {};

    if (!form.tipoGastoId) {
      nuevosErrores.tipoGastoId = 'Selecciona una categoría de gasto.';
    }

    const precio = parseFloat(form.precio.replace(',', '.'));
    if (!form.precio || isNaN(precio) || precio <= 0) {
      nuevosErrores.precio = 'Ingresa un precio válido mayor a cero.';
    }

    if (!form.proveedor.trim()) {
      nuevosErrores.proveedor = 'El proveedor no puede estar vacío.';
    } else if (form.proveedor.trim().length < 2) {
      nuevosErrores.proveedor = 'El proveedor debe tener al menos 2 caracteres.';
    }

    if (!form.fecha) {
      nuevosErrores.fecha = 'Selecciona una fecha válida.';
    } else {
      const fecha = inputValueToDate(form.fecha);
      if (!fecha) {
        nuevosErrores.fecha = 'La fecha ingresada no es válida.';
      }
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // ═══════════════════════════════════════════════════════
  // Guardar nuevo gasto
  // ═══════════════════════════════════════════════════════
  const handleGuardar = async () => {
    if (!camadaSeleccionada?.id) {
      showAlert('Atención', 'Debes seleccionar una camada primero.');
      return;
    }
    if (!validarForm()) return;

    const fecha = inputValueToDate(form.fecha) || new Date();
    const precio = parseFloat(form.precio.replace(',', '.'));

    const nuevoGasto: NuevoGastoInput = {
      camadaId: camadaSeleccionada.id,
      tipoGastoId: form.tipoGastoId,
      tipoGastoNombre: form.tipoGastoNombre,
      precio,
      proveedor: form.proveedor.trim(),
      fecha,
    };

    try {
      setGuardando(true);
      await crearGasto(nuevoGasto);
      setModalFormVisible(false);
      setForm(FORM_INICIAL);
      setErrores({});
      await cargarGastos(camadaSeleccionada.id);
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      showAlert('Error', 'No se pudo registrar el gasto. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // Eliminar gasto
  // ═══════════════════════════════════════════════════════
  const handleEliminar = (gasto: Gasto) => {
    if (!gasto.id) return;
    if (isWeb) {
      setGastoAEliminar(gasto);
      setConfirmEliminarVisible(true);
    } else {
      showAlert(
        'Eliminar Gasto',
        `¿Eliminar "${gasto.tipoGastoNombre}" de ${formatMoneda(gasto.precio)}?\n\nEsto descontará el monto del total de la camada.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => confirmarEliminacion(gasto),
          },
        ]
      );
    }
  };

  const confirmarEliminacion = async (gasto: Gasto) => {
    if (!gasto.id) return;
    try {
      setCargandoGastos(true);
      await eliminarGasto(gasto.id);
      if (camadaSeleccionada?.id) {
        await cargarGastos(camadaSeleccionada.id);
      }
    } catch (error) {
      console.error('Error al eliminar gasto:', error);
      showAlert('Error', 'No se pudo eliminar el gasto.');
    } finally {
      setConfirmEliminarVisible(false);
      setGastoAEliminar(null);
      setCargandoGastos(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // Abrir formulario nuevo gasto
  // ═══════════════════════════════════════════════════════
  const abrirModalForm = () => {
    if (!camadaSeleccionada) {
      showAlert('Sin camada', 'Selecciona una camada antes de registrar un gasto.');
      return;
    }
    setForm(FORM_INICIAL);
    setErrores({});
    setModalFormVisible(true);
  };

  // ═══════════════════════════════════════════════════════
  // Total acumulado de gastos de la camada
  // ═══════════════════════════════════════════════════════
  const totalGastosLocal = gastos.reduce((acc, g) => acc + g.precio, 0);

  // ═══════════════════════════════════════════════════════
  // Renderizado de tarjeta de gasto
  // ═══════════════════════════════════════════════════════
  const renderGasto = ({ item }: { item: Gasto }) => (
    <View style={styles.gastoCard}>
      <View style={styles.gastoLeft}>
        <View style={styles.gastoIcono}>
          <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
        </View>
        <View style={styles.gastoInfo}>
          <Text style={styles.gastoTipo}>{item.tipoGastoNombre || 'Sin categoría'}</Text>
          <Text style={styles.gastoProveedor}>{item.proveedor}</Text>
          <Text style={styles.gastoFecha}>{formatFecha(item.fecha)}</Text>
        </View>
      </View>
      <View style={styles.gastoRight}>
        <Text style={styles.gastoPrecio}>{formatMoneda(item.precio)}</Text>
        <TouchableOpacity
          style={styles.eliminarBtn}
          onPress={() => handleEliminar(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════
  // Contenido principal: lista o empty state
  // ═══════════════════════════════════════════════════════
  const renderContenidoPrincipal = () => {
    if (!camadaSeleccionada) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="albums-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Sin camada seleccionada</Text>
          <Text style={styles.emptyDesc}>
            Elige una camada para ver y registrar sus gastos.
          </Text>
          <TouchableOpacity
            style={styles.seleccionarBtn}
            onPress={() => setModalCamadaVisible(true)}
          >
            <Ionicons name="list-outline" size={18} color="#fff" />
            <Text style={styles.seleccionarBtnText}>Seleccionar Camada</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (cargandoGastos) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.cargandoText}>Cargando gastos...</Text>
        </View>
      );
    }

    return (
      <>
        {/* ── Resumen por categoría ── */}
        {resumen.length > 0 && (
          <View style={styles.resumenSection}>
            <Text style={styles.sectionLabel}>Distribución por categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.resumenRow}>
                {resumen.map((item, index) => (
                  <View
                    key={item.tipoGastoNombre}
                    style={[
                      styles.resumenCard,
                      { borderLeftColor: colorCategoria(index) },
                    ]}
                  >
                    <Text style={styles.resumenNombre} numberOfLines={1}>
                      {item.tipoGastoNombre}
                    </Text>
                    <Text
                      style={[styles.resumenTotal, { color: colorCategoria(index) }]}
                    >
                      {formatMoneda(item.totalInvertido)}
                    </Text>
                    <Text style={styles.resumenMeta}>
                      {item.porcentaje}% · {item.cantidadCompras}{' '}
                      {item.cantidadCompras === 1 ? 'compra' : 'compras'}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Lista de gastos ── */}
        <Text style={styles.sectionLabel}>
          Detalle de gastos ({gastos.length})
        </Text>
        {gastos.length === 0 ? (
          <View style={styles.emptyListContainer}>
            <Ionicons name="document-text-outline" size={44} color={COLORS.textSecondary} />
            <Text style={styles.emptyListText}>
              Aún no hay gastos registrados para esta camada.
            </Text>
          </View>
        ) : isWeb ? (
          <ScrollView>
            {gastos.map((item) => (
              <View key={item.id}>{renderGasto({ item })}</View>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            data={gastos}
            keyExtractor={(item) => item.id || Math.random().toString()}
            renderItem={renderGasto}
            refreshControl={
              <RefreshControl
                refreshing={refrescando}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          />
        )}
      </>
    );
  };

  // ─────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.cargandoText}>Cargando datos de la granja...</Text>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Registro de Gastos</Text>
          {camadaSeleccionada ? (
            <TouchableOpacity
              style={styles.camadaSelector}
              onPress={() => setModalCamadaVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
              <Text style={styles.camadaSelectorText} numberOfLines={1}>
                {camadaSeleccionada.nombre}
              </Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.camadaSelector}
              onPress={() => setModalCamadaVisible(true)}
            >
              <Text style={[styles.camadaSelectorText, { color: COLORS.textSecondary }]}>
                Toca para elegir una camada
              </Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerActions}>
          {isWeb && camadaSeleccionada && (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={onRefresh}
              disabled={refrescando}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.nuevoBtn}
            onPress={abrirModalForm}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.nuevoBtnText}>Nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Total en header ── */}
      {camadaSeleccionada && gastos.length > 0 && (
        <View style={styles.totalBanner}>
          <Text style={styles.totalBannerLabel}>Total invertido en esta camada</Text>
          <Text style={styles.totalBannerValor}>{formatMoneda(totalGastosLocal)}</Text>
        </View>
      )}

      {/* ── Contenido ── */}
      <View style={[styles.contenido, isWide && styles.contenidoWide]}>
        {renderContenidoPrincipal()}
      </View>

      {/* ════════════════════════════════════════════════ */}
      {/* Modal: Selección de Camada                      */}
      {/* ════════════════════════════════════════════════ */}
      <Modal
        visible={modalCamadaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCamadaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Camada</Text>
              <TouchableOpacity onPress={() => setModalCamadaVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {camadas.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>
                  No hay camadas registradas en el sistema.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 350 }}>
                {camadas.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.camadaOpcion,
                      camadaSeleccionada?.id === c.id && styles.camadaOpcionActiva,
                    ]}
                    onPress={() => seleccionarCamada(c)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.camadaOpcionLeft}>
                      <Ionicons
                        name="layers-outline"
                        size={20}
                        color={
                          camadaSeleccionada?.id === c.id
                            ? COLORS.primary
                            : COLORS.textSecondary
                        }
                      />
                      <View>
                        <Text
                          style={[
                            styles.camadaOpcionNombre,
                            camadaSeleccionada?.id === c.id &&
                            styles.camadaOpcionNombreActiva,
                          ]}
                        >
                          {c.nombre}
                        </Text>
                        <Text style={styles.camadaOpcionMeta}>
                          {c.activa ? '🟢 Activa' : '🔴 Finalizada'} ·{' '}
                          {c.cantidadPollos} pollos · {formatMoneda(c.totalGastos)}
                        </Text>
                      </View>
                    </View>
                    {camadaSeleccionada?.id === c.id && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/* Modal: Formulario de Nuevo Gasto                */}
      {/* ════════════════════════════════════════════════ */}
      <Modal
        visible={modalFormVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalFormVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{ alignItems: 'center', padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContent, { maxWidth: 520, width: '100%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nuevo Gasto</Text>
                <TouchableOpacity onPress={() => setModalFormVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Camada (informativo) */}
              <View style={styles.fieldCamadaInfo}>
                <Ionicons name="layers-outline" size={16} color={COLORS.primary} />
                <Text style={styles.fieldCamadaInfoText}>
                  Camada: {camadaSeleccionada?.nombre}
                </Text>
              </View>

              {/* ── Tipo de Gasto ── */}
              <Text style={styles.inputLabel}>Categoría de gasto *</Text>
              <TouchableOpacity
                style={[
                  styles.selectorBtn,
                  errores.tipoGastoId ? styles.inputError : null,
                ]}
                onPress={() => setModalTipoVisible(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    !form.tipoGastoId && { color: COLORS.textSecondary },
                  ]}
                >
                  {form.tipoGastoNombre || 'Selecciona una categoría...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
              {errores.tipoGastoId && (
                <Text style={styles.errorText}>{errores.tipoGastoId}</Text>
              )}

              {/* ── Precio ── */}
              <Text style={styles.inputLabel}>Precio / Monto *</Text>
              <TextInput
                style={[styles.input, errores.precio ? styles.inputError : null]}
                placeholder="Ej. 1500.00"
                placeholderTextColor={COLORS.textSecondary}
                value={form.precio}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, precio: v }));
                  if (errores.precio) setErrores((e) => ({ ...e, precio: undefined }));
                }}
                keyboardType="decimal-pad"
              />
              {errores.precio && (
                <Text style={styles.errorText}>{errores.precio}</Text>
              )}

              {/* ── Proveedor ── */}
              <Text style={styles.inputLabel}>Proveedor *</Text>
              <TextInput
                style={[styles.input, errores.proveedor ? styles.inputError : null]}
                placeholder="Ej. Agroveterinaria San Juan"
                placeholderTextColor={COLORS.textSecondary}
                value={form.proveedor}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, proveedor: v }));
                  if (errores.proveedor) setErrores((e) => ({ ...e, proveedor: undefined }));
                }}
                returnKeyType="next"
              />
              {errores.proveedor && (
                <Text style={styles.errorText}>{errores.proveedor}</Text>
              )}

              {/* ── Fecha ── */}
              <Text style={styles.inputLabel}>Fecha del gasto *</Text>
              <TextInput
                style={[styles.input, errores.fecha ? styles.inputError : null]}
                value={form.fecha}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, fecha: v }));
                  if (errores.fecha) setErrores((e) => ({ ...e, fecha: undefined }));
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textSecondary}
                // En web, el input type="date" nativo funciona via placeholder
                maxLength={10}
              />
              <Text style={styles.inputHint}>Formato: YYYY-MM-DD (Ej. 2024-10-15)</Text>
              {errores.fecha && (
                <Text style={styles.errorText}>{errores.fecha}</Text>
              )}

              {/* ── Acciones ── */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalFormVisible(false)}
                  disabled={guardando}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.guardarBtn, guardando && styles.btnDisabled]}
                  onPress={handleGuardar}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                      <Text style={styles.guardarBtnText}>Registrar Gasto</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/* Modal: Picker de Tipo de Gasto                  */}
      {/* ════════════════════════════════════════════════ */}
      <Modal
        visible={modalTipoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalTipoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Categoría de Gasto</Text>
              <TouchableOpacity onPress={() => setModalTipoVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {tiposGasto.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>
                  No hay categorías registradas. Ve a "Tipos de Gasto" para crearlas.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340 }}>
                {tiposGasto.map((tipo) => (
                  <TouchableOpacity
                    key={tipo.id}
                    style={[
                      styles.tipoOpcion,
                      form.tipoGastoId === tipo.id && styles.tipoOpcionActiva,
                    ]}
                    onPress={() => {
                      setForm((f) => ({
                        ...f,
                        tipoGastoId: tipo.id || '',
                        tipoGastoNombre: tipo.nombre,
                      }));
                      setErrores((e) => ({ ...e, tipoGastoId: undefined }));
                      setModalTipoVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tipoOpcionLeft}>
                      <Ionicons
                        name="pricetag-outline"
                        size={18}
                        color={
                          form.tipoGastoId === tipo.id
                            ? COLORS.primary
                            : COLORS.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.tipoOpcionNombre,
                          form.tipoGastoId === tipo.id && styles.tipoOpcionNombreActiva,
                        ]}
                      >
                        {tipo.nombre}
                      </Text>
                    </View>
                    {form.tipoGastoId === tipo.id && (
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/* Modal: Confirmación eliminar (solo Web)         */}
      {/* ════════════════════════════════════════════════ */}
      {isWeb && (
        <Modal
          visible={confirmEliminarVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmEliminarVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Eliminar Gasto</Text>
                <TouchableOpacity
                  onPress={() => {
                    setConfirmEliminarVisible(false);
                    setGastoAEliminar(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {gastoAEliminar && (
                <>
                  <Text style={styles.confirmText}>
                    ¿Eliminar el gasto de{' '}
                    <Text style={styles.confirmBold}>
                      {formatMoneda(gastoAEliminar.precio)}
                    </Text>{' '}
                    en{' '}
                    <Text style={styles.confirmBold}>
                      {gastoAEliminar.tipoGastoNombre}
                    </Text>
                    ?
                  </Text>
                  <Text style={styles.confirmSubtext}>
                    Este monto se descontará automáticamente del total de la camada.
                  </Text>
                </>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setConfirmEliminarVisible(false);
                    setGastoAEliminar(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.eliminarConfirmBtn}
                  onPress={() =>
                    gastoAEliminar && confirmarEliminacion(gastoAEliminar)
                  }
                >
                  <Ionicons name="trash-outline" size={16} color="#FFF" />
                  <Text style={styles.guardarBtnText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cargandoText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  // ── Header ─────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  camadaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  camadaSelectorText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    maxWidth: 180,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  headerIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nuevoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  nuevoBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Banner de Total ─────────────────────────────────────
  totalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  totalBannerLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  totalBannerValor: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // ── Contenido ───────────────────────────────────────────
  contenido: {
    flex: 1,
    padding: 16,
  },
  contenidoWide: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },

  // ── Resumen de categorías ────────────────────────────────
  resumenSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  resumenRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resumenCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    minWidth: 140,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resumenNombre: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  resumenTotal: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  resumenMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  // ── Tarjeta de gasto ─────────────────────────────────────
  gastoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gastoLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  gastoIcono: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gastoInfo: {
    flex: 1,
    gap: 2,
  },
  gastoTipo: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  gastoProveedor: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  gastoFecha: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gastoRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  gastoPrecio: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  eliminarBtn: {
    padding: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },

  // ── Empty states ─────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 14,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  seleccionarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  seleccionarBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyListContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyListText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Modal base ───────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // ── Formulario ───────────────────────────────────────────
  fieldCamadaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  fieldCamadaInfoText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    outlineStyle: 'none',
  } as any,
  inputHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  selectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  selectorBtnText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 1,
  },

  // ── Opciones de camada/tipo ──────────────────────────────
  camadaOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: COLORS.background,
  },
  camadaOpcionActiva: {
    backgroundColor: COLORS.primaryLight,
  },
  camadaOpcionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  camadaOpcionNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  camadaOpcionNombreActiva: {
    color: COLORS.primary,
  },
  camadaOpcionMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tipoOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: COLORS.background,
  },
  tipoOpcionActiva: {
    backgroundColor: COLORS.primaryLight,
  },
  tipoOpcionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipoOpcionNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tipoOpcionNombreActiva: {
    color: COLORS.primary,
  },

  // ── Acciones de modal ────────────────────────────────────
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  guardarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    minWidth: 130,
    justifyContent: 'center',
  },
  guardarBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  eliminarConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    minWidth: 100,
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 6,
  },
  confirmBold: {
    fontWeight: '700',
  },
  confirmSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
});
