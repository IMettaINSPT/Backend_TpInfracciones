import { Types } from 'mongoose';
import { InfraccionModel } from '../models/Infraccion';
import { VehiculoModel } from '../models/Vehiculo';
import { PagoModel } from '../models/Pago';

export interface FiltroPeriodo {
  fechaDesde?: string | Date;
  fechaHasta?: string | Date;
}

export class PanelService {
  /**
   * 1. Cálculo de deuda exigible por patente/vehículo
   */
  static async obtenerDeudaPorPatente(patente: string) {
    const vehiculo = await VehiculoModel.findOne({ patente: patente.trim().toUpperCase() });
    if (!vehiculo) {
      return null;
    }

    const resultado = await InfraccionModel.aggregate([
      {
        $match: {
          vehiculo: vehiculo._id,
          estado: { $in: ['pendiente', 'notificada', 'en descargo'] },
        },
      },
      {
        $group: {
          _id: '$vehiculo',
          deudaTotal: { $sum: '$monto' },
          cantidadActasImpagas: { $sum: 1 },
          actas: {
            $push: {
              _id: '$_id',
              numeroActa: '$numeroActa',
              monto: '$monto',
              tipoFalta: '$tipoFalta',
              estado: '$estado',
              fechaHora: '$fechaHora',
            },
          },
        },
      },
    ]);

    const resumen = resultado[0] || { deudaTotal: 0, cantidadActasImpagas: 0, actas: [] };
    return {
      vehiculo: {
        _id: vehiculo._id,
        patente: vehiculo.patente,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
      },
      ...resumen,
    };
  }

  /**
   * 2. Cálculo de deuda consolidada por titular
   */
  static async obtenerDeudaPorTitular(titularId: string) {
    const objectId = new Types.ObjectId(titularId);

    // Buscar rodados donde el titular esté activo
    const vehiculos = await VehiculoModel.find({
      'titulares.titular': objectId,
      'titulares.fechaBajaRegistro': { $exists: false },
    }).select('_id patente marca modelo');

    const vehiculoIds = vehiculos.map((v) => v._id);

    if (vehiculoIds.length === 0) {
      return {
        titularId,
        deudaTotal: 0,
        cantidadActasImpagas: 0,
        vehiculosAsociados: 0,
        actas: [],
      };
    }

    const resultado = await InfraccionModel.aggregate([
      {
        $match: {
          vehiculo: { $in: vehiculoIds },
          estado: { $in: ['pendiente', 'notificada', 'en descargo'] },
        },
      },
      {
        $group: {
          _id: null,
          deudaTotal: { $sum: '$monto' },
          cantidadActasImpagas: { $sum: 1 },
          actas: {
            $push: {
              _id: '$_id',
              numeroActa: '$numeroActa',
              monto: '$monto',
              tipoFalta: '$tipoFalta',
              estado: '$estado',
              vehiculo: '$vehiculo',
            },
          },
        },
      },
    ]);

    const resumen = resultado[0] || { deudaTotal: 0, cantidadActasImpagas: 0, actas: [] };
    return {
      titularId,
      vehiculosAsociados: vehiculos.length,
      deudaTotal: resumen.deudaTotal,
      cantidadActasImpagas: resumen.cantidadActasImpagas,
      actas: resumen.actas,
    };
  }

  /**
   * 3. Métricas generales del período: estados, recaudación y estadísticas
   */
  static async obtenerMetricasPeriodo(filtro?: FiltroPeriodo) {
    const matchFiltro: Record<string, any> = {};

    if (filtro?.fechaDesde || filtro?.fechaHasta) {
      matchFiltro.fechaHora = {};
      if (filtro.fechaDesde) matchFiltro.fechaHora.$gte = new Date(filtro.fechaDesde);
      if (filtro.fechaHasta) {
        const hasta = new Date(filtro.fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        matchFiltro.fechaHora.$lte = hasta;
      }
    }

    // A. Actas agrupadas por estado con conteo y montos
    const agrupadoEstado = await InfraccionModel.aggregate([
      { $match: matchFiltro },
      {
        $group: {
          _id: '$estado',
          cantidad: { $sum: 1 },
          montoAcumulado: { $sum: '$monto' },
        },
      },
    ]);

    // B. Recaudación real cobrada desde la entidad Pago
    const filtroPagos: Record<string, any> = { estado: 'completado' };
    if (filtro?.fechaDesde || filtro?.fechaHasta) {
      filtroPagos.fechaPago = {};
      if (filtro.fechaDesde) filtroPagos.fechaPago.$gte = new Date(filtro.fechaDesde);
      if (filtro.fechaHasta) {
        const hastaPago = new Date(filtro.fechaHasta);
        hastaPago.setHours(23, 59, 59, 999);
        filtroPagos.fechaPago.$lte = hastaPago;
      }
    }

    const recaudacionPorMedio = await PagoModel.aggregate([
      { $match: filtroPagos },
      {
        $group: {
          _id: '$medioPago',
          totalCobrado: { $sum: '$montoTotalAbonado' },
          transacciones: { $sum: 1 },
        },
      },
    ]);

    const totalRecaudado = recaudacionPorMedio.reduce((acc, curr) => acc + curr.totalCobrado, 0);

    // C. Top 5 Faltas más recurrentes
    const topFaltas = await InfraccionModel.aggregate([
      { $match: matchFiltro },
      {
        $group: {
          _id: '$tipoFalta',
          cantidad: { $sum: 1 },
          montoTotal: { $sum: '$monto' },
        },
      },
      { $sort: { cantidad: -1 } },
      { $limit: 5 },
    ]);

    // D. Puntos de la ciudad con más infracciones
    const zonasCriticas = await InfraccionModel.aggregate([
      { $match: matchFiltro },
      {
        $group: {
          _id: '$lugar',
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { cantidad: -1 } },
      { $limit: 5 },
    ]);

    return {
      actasPorEstado: agrupadoEstado,
      recaudacion: {
        totalRecaudado,
        desglosePorMedio: recaudacionPorMedio,
      },
      estadisticas: {
        topFaltas,
        zonasCriticas,
      },
    };
  }
}