import { useState, useEffect, useCallback } from 'react';
import {
  Camada,
  Gasto,
  TipoGasto,
  NuevaCamadaInput,
  NuevoGastoInput,
  calcularMetricasCamada,
  obtenerPollosVivos,
  obtenerTasaMortalidad,
  obtenerCostoPorPolloVivo,
} from '../models';
import {
  CamadaService,
  GastoService,
  TipoGastoService,
  IAlertaCamada,
  IResumenGranja,
} from '../services';

/**
 * Hook para gestionar el estado y operaciones de la granja avícola en componentes React Native.
 */
export const useGranja = () => {
  const [camadas, setCamadas] = useState<Camada[]>([]);
  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [alertas, setAlertas] = useState<IAlertaCamada[]>([]);
  const [resumen, setResumen] = useState<IResumenGranja | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carga inicial y refresco de los datos principales.
   */
  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      // Inicializar catálogo base si es la primera vez
      await TipoGastoService.inicializarCatalogoSiVacio();

      const [camadasActivas, catalogo, proximasAlertas, resumenGlobal] = await Promise.all([
        CamadaService.obtenerActivas(),
        TipoGastoService.obtenerTodos(),
        CamadaService.obtenerAlertasProximas(7),
        CamadaService.obtenerResumenGranja(),
      ]);

      setCamadas(camadasActivas);
      setTiposGasto(catalogo);
      setAlertas(proximasAlertas);
      setResumen(resumenGlobal);
    } catch (err: any) {
      console.error('Error al cargar datos de la granja:', err);
      setError(err?.message || 'Error al conectar con Firestore');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  /**
   * Registrar una nueva camada.
   */
  const agregarCamada = async (nuevaCamada: NuevaCamadaInput) => {
    const id = await CamadaService.crear(nuevaCamada);
    await cargarDatos();
    return id;
  };

  /**
   * Registrar bajas (muertes de pollos).
   */
  const registrarBajas = async (camadaId: string, cantidad: number) => {
    await CamadaService.registrarBajas(camadaId, cantidad);
    await cargarDatos();
  };

  /**
   * Registrar un nuevo gasto asociado a una camada.
   */
  const registrarGasto = async (nuevoGasto: NuevoGastoInput) => {
    const id = await GastoService.crear(nuevoGasto);
    await cargarDatos();
    return id;
  };

  return {
    camadas,
    tiposGasto,
    alertas,
    resumen,
    cargando,
    error,
    refrescar: cargarDatos,
    agregarCamada,
    registrarBajas,
    registrarGasto,
    // Funciones utilitarias para vistas
    calcularMetricasCamada,
    obtenerPollosVivos,
    obtenerTasaMortalidad,
    obtenerCostoPorPolloVivo,
  };
};
