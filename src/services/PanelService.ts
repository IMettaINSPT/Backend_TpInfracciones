// src/services/PanelService.ts
import { Types } from 'mongoose';
import { InfraccionModel } from '../models/Infraccion';
import { VehiculoModel } from '../models/Vehiculo';
import { PagoModel } from '../models/Pago';
import { IFiltroPeriodo } from '../types';

export class PanelService {
 

  static async obtenerDeudaPorPatente(patente: string) {
    const vehiculo = await VehiculoModel.findOne({ patente: patente.trim().toUpperCase() });
    if (!vehiculo) {
      return null;
    }

    const resultado = await InfraccionModel.aggregate([
      {
        $match: {
          vehiculo: vehiculo._id, // Ya es un Types.ObjectId
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

  static async obtenerDeudaPorTitular(titularId: string | Types.ObjectId) {
    const objectIdTitular = typeof titularId === 'string' ? new Types.ObjectId(titularId) : titularId;

    // Buscar rodados donde el titular esté activo (sin fecha de baja)
    const vehiculos = await VehiculoModel.find({
      'titulares.titular': objectIdTitular,
      'titulares.fechaBajaRegistro': { $exists: false },
    }).select('_id patente marca modelo');

    const vehiculoIds: Types.ObjectId[] = vehiculos.map((v) => v._id as Types.ObjectId);

    if (vehiculoIds.length === 0) {
      return {
        titularId: objectIdTitular.toString(),
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
      titularId: objectIdTitular.toString(),
      vehiculosAsociados: vehiculos.length,
      deudaTotal: resumen.deudaTotal,
      cantidadActasImpagas: resumen.cantidadActasImpagas,
      actas: resumen.actas,
    };
  }

  
  static async obtenerMetricasPeriodo(filtro?: IFiltroPeriodo) {
    const matchFiltroInfracciones: Record<string, any> = {};

    if (filtro?.fechaDesde || filtro?.fechaHasta) {
      matchFiltroInfracciones.fechaHora = {};
      if (filtro.fechaDesde) {
        matchFiltroInfracciones.fechaHora.$gte = new Date(filtro.fechaDesde);
      }
      if (filtro.fechaHasta) {
        const hasta = new Date(filtro.fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        matchFiltroInfracciones.fechaHora.$lte = hasta;
      }
    }

    // A. Actas agrupadas por estado (conteo y monto acumulado)
    const actasPorEstado = await InfraccionModel.aggregate([
      { $match: matchFiltroInfracciones },
      {
        $group: {
          _id: '$estado',
          cantidad: { $sum: 1 },
          montoAcumulado: { $sum: '$monto' },
        },
      },
    ]);

    // B. Recaudación real cobrada desde la entidad Pago (solo completados, no anulados)
    const matchFiltroPagos: Record<string, any> = { estado: 'completado' };

    if (filtro?.fechaDesde || filtro?.fechaHasta) {
      matchFiltroPagos.fechaPago = {};
      if (filtro.fechaDesde) {
        matchFiltroPagos.fechaPago.$gte = new Date(filtro.fechaDesde);
      }
      if (filtro.fechaHasta) {
        const hastaPago = new Date(filtro.fechaHasta);
        hastaPago.setHours(23, 59, 59, 999);
        matchFiltroPagos.fechaPago.$lte = hastaPago;
      }
    }

    // Desglose exclusivamente para medios de cobro digitales
    const recaudacionPorMedio = await PagoModel.aggregate([
      { $match: matchFiltroPagos },
      {
        $group: {
          _id: '$medioPago', // Agrupa por 'tarjeta' y 'billetera_virtual'
          totalCobrado: { $sum: '$montoTotalAbonado' },
          transacciones: { $sum: 1 },
        },
      },
    ]);

    const totalRecaudado = recaudacionPorMedio.reduce((acc, curr) => acc + curr.totalCobrado, 0);

    // C. Top 5 Faltas más recurrentes
    const topFaltas = await InfraccionModel.aggregate([
      { $match: matchFiltroInfracciones },
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

    // D. Puntos críticos con mayor concentración de faltas
    const zonasCriticas = await InfraccionModel.aggregate([
      { $match: matchFiltroInfracciones },
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
      actasPorEstado,
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