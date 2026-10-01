import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { TipoGasto } from '../models';
import {
  obtenerTiposGasto,
  crearTipoGasto,
  actualizarTipoGasto,
  eliminarTipoGasto,
  inicializarCatalogoTipoGastoSiVacio,
  TipoGastoEnUsoError,
} from '../services';
import { showAlert } from '../utils';

const isWeb = Platform.OS === 'web';

export const TiposGastoScreen: React.FC = () => {
  // ==========================================
  // Estados de datos y UI
  // ==========================================
  const [tipos, setTipos] = useState<TipoGasto[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [refrescando, setRefrescando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);

  // Estados del Modal (Crear / Editar)
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [tipoEnEdicion, setTipoEnEdicion] = useState<TipoGasto | null>(null);
  const [nombreInput, setNombreInput] = useState<string>('');
  const [errorInput, setErrorInput] = useState<string | null>(null);

  // Dialogo de confirmación de eliminación (web no tiene Alert nativo)
  const [confirmEliminarVisible, setConfirmEliminarVisible] = useState<boolean>(false);
  const [tipoAEliminar, setTipoAEliminar] = useState<TipoGasto | null>(null);

  // ==========================================
  // Lógica de Carga de Datos
  // ==========================================
  const cargarTipos = useCallback(async () => {
    try {
      setErrorInput(null);
      const data = await obtenerTiposGasto();
      setTipos(data);
    } catch (error: any) {
      console.error('Error al cargar tipos de gasto:', error);
      showAlert('Error', 'No se pudieron cargar los tipos de gasto desde Firestore.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargarTipos();
  }, [cargarTipos]);

  const onRefresh = () => {
    setRefrescando(true);
    cargarTipos();
  };

  // ==========================================
  // Reglas de Validación de Negocio
  // ==========================================
  const validarNombre = (nombre: string, idActual?: string): string | null => {
    const limpio = nombre.trim();

    if (!limpio) {
      return 'El nombre de la categoría no puede estar vacío.';
    }

    if (limpio.length < 3) {
      return 'El nombre debe tener al menos 3 caracteres.';
    }

    // Regla de Negocio: Evitar nombres duplicados (case-insensitive)
    const yaExiste = tipos.some(
      (item) =>
        item.nombre.trim().toLowerCase() === limpio.toLowerCase() &&
        item.id !== idActual
    );

    if (yaExiste) {
      return 'Ya existe una categoría de gasto con este nombre.';
    }

    return null;
  };

  // ==========================================
  // Acciones CRUD
  // ==========================================
  const abrirModalCrear = () => {
    setTipoEnEdicion(null);
    setNombreInput('');
    setErrorInput(null);
    setModalVisible(true);
  };

  const abrirModalEditar = (tipo: TipoGasto) => {
    setTipoEnEdicion(tipo);
    setNombreInput(tipo.nombre);
    setErrorInput(null);
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    const errorValidacion = validarNombre(nombreInput, tipoEnEdicion?.id);
    if (errorValidacion) {
      setErrorInput(errorValidacion);
      return;
    }

    try {
      setGuardando(true);
      setErrorInput(null);

      if (tipoEnEdicion && tipoEnEdicion.id) {
        await actualizarTipoGasto(tipoEnEdicion.id, nombreInput.trim());
      } else {
        await crearTipoGasto(nombreInput.trim());
      }

      setModalVisible(false);
      await cargarTipos();
    } catch (error: any) {
      console.error('Error al guardar tipo de gasto:', error);
      setErrorInput('Ocurrió un error al guardar en la base de datos.');
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Solicitar confirmación de eliminación.
   * En Android/iOS usa Alert nativo; en Web usa modal interno.
   */
  const handleEliminar = (tipo: TipoGasto) => {
    if (!tipo.id) return;

    if (isWeb) {
      // En web mostramos nuestro propio modal de confirmación
      setTipoAEliminar(tipo);
      setConfirmEliminarVisible(true);
    } else {
      showAlert(
        'Eliminar Categoría',
        `¿Estás seguro de que deseas eliminar "${tipo.nombre}"?\n\nLos gastos previamente registrados con este concepto podrían verse afectados.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => confirmarEliminacion(tipo),
          },
        ]
      );
    }
  };

  const confirmarEliminacion = async (tipo: TipoGasto) => {
    if (!tipo.id) return;
    try {
      setCargando(true);
      await eliminarTipoGasto(tipo.id);
      await cargarTipos();
    } catch (error) {
      console.error('Error al eliminar:', error);
      if (error instanceof TipoGastoEnUsoError) {
        showAlert('Categoría en uso', error.message);
      } else {
        showAlert('Error', 'No se pudo eliminar el tipo de gasto.');
      }
      setCargando(false);
    } finally {
      setConfirmEliminarVisible(false);
      setTipoAEliminar(null);
    }
  };

  const handleCargarCatalogoBase = async () => {
    try {
      setCargando(true);
      await inicializarCatalogoTipoGastoSiVacio();
      await cargarTipos();
      showAlert('Éxito', 'Catálogo base inicializado correctamente.');
    } catch (error) {
      console.error('Error al inicializar catálogo:', error);
      showAlert('Error', 'No se pudo cargar el catálogo base.');
      setCargando(false);
    }
  };

  // ==========================================
  // Renderizado de Items
  // ==========================================
  const renderItem = ({ item }: { item: TipoGasto }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.iconCircle}>
          <Ionicons name="pricetag-outline" size={20} color={COLORS.primary} />
        </View>
        <Text style={styles.cardTitle}>{item.nombre}</Text>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => abrirModalEditar(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleEliminar(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ==========================================
  // Lista: FlatList en native, ScrollView en web
  // ==========================================
  const renderLista = () => {
    if (isWeb) {
      // En web FlatList + RefreshControl pueden tener problemas de overflow
      return (
        <ScrollView
          contentContainerStyle={styles.listContent}
          style={{ flex: 1 }}
        >
          {tipos.map((item) => (
            <View key={item.id || item.nombre}>
              {renderItem({ item })}
            </View>
          ))}
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={tipos}
        keyExtractor={(item) => item.id || item.nombre}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      />
    );
  };

  // ==========================================
  // Renderizado Principal
  // ==========================================
  return (
    <View style={styles.container}>
      {/* Encabezado con contador y botón nuevo */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tipos de Gasto</Text>
          <Text style={styles.headerSubtitle}>
            {tipos.length} {tipos.length === 1 ? 'categoría registrada' : 'categorías registradas'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* Botón refrescar solo en web */}
          {isWeb && (
            <TouchableOpacity
              style={[styles.createButton, styles.refreshButton]}
              onPress={onRefresh}
              activeOpacity={0.8}
              disabled={refrescando}
            >
              <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.createButton}
            onPress={abrirModalCrear}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Nueva</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido principal */}
      {cargando && !refrescando ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando catálogo...</Text>
        </View>
      ) : tipos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Sin categorías de gasto</Text>
          <Text style={styles.emptyDescription}>
            Aún no has registrado ningún tipo de gasto para tus camadas.
          </Text>

          <TouchableOpacity
            style={styles.baseButton}
            onPress={handleCargarCatalogoBase}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
            <Text style={styles.baseButtonText}>Cargar Catálogo Inicial</Text>
          </TouchableOpacity>
          <Text style={styles.baseHintText}>
            (Alimento inicio, Alimentos desarrollo, Alimento engorde, Desparasitación)
          </Text>
        </View>
      ) : (
        renderLista()
      )}

      {/* ========================================== */}
      {/* Modal para Crear o Editar                  */}
      {/* ========================================== */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {tipoEnEdicion ? 'Editar Categoría' : 'Nueva Categoría de Gasto'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nombre del concepto / tipo</Text>
            <TextInput
              style={[styles.input, errorInput ? styles.inputError : null]}
              placeholder="Ej. Alimento inicio, Medicamentos..."
              placeholderTextColor={COLORS.textSecondary}
              value={nombreInput}
              onChangeText={(text) => {
                setNombreInput(text);
                if (errorInput) setErrorInput(null);
              }}
              autoFocus
              // En web, Enter confirma
              onSubmitEditing={handleGuardar}
              returnKeyType="done"
            />

            {errorInput && <Text style={styles.errorText}>{errorInput}</Text>}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={guardando}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, guardando ? styles.saveButtonDisabled : null]}
                onPress={handleGuardar}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {tipoEnEdicion ? 'Actualizar' : 'Guardar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================== */}
      {/* Modal de Confirmación de Eliminación (Web) */}
      {/* ========================================== */}
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
                <Text style={styles.modalTitle}>Eliminar Categoría</Text>
                <TouchableOpacity
                  onPress={() => setConfirmEliminarVisible(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.confirmText}>
                ¿Estás seguro de que deseas eliminar{' '}
                <Text style={styles.confirmTextBold}>"{tipoAEliminar?.nombre}"</Text>?
              </Text>
              <Text style={styles.confirmSubtext}>
                Solo se puede eliminar si no hay gastos registrados con esta categoría.
              </Text>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setConfirmEliminarVisible(false);
                    setTipoAEliminar(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteConfirmButton}
                  onPress={() => tipoAEliminar && confirmarEliminacion(tipoAEliminar)}
                >
                  <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  refreshButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
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
  emptyDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  baseButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  baseHintText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 280,
  },
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
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
    outlineStyle: 'none', // Quita el outline azul en web
  } as any,
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
  },
  confirmText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 6,
    lineHeight: 22,
  },
  confirmTextBold: {
    fontWeight: '700',
  },
  confirmSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    minWidth: 90,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  deleteConfirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    minWidth: 90,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
