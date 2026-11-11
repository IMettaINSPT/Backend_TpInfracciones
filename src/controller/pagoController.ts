// src/controller/pagoController.ts
import { Request, Response, NextFunction } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { PagoModel } from '../models/Pago';
import { InfraccionModel } from '../models/Infraccion';
import { UserModel } from '../models/User';
import { registrarAuditoria } from '../services/AuditService';
import { PagoCompleto, IDatosTarjeta, IDatosBilletera } from '../types';

const generarComprobante = () => {
  const anio = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `REC-${anio}-${random}`;
};

// pago online
export const registrarPago = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { infraccionesIds, medioPago, pagador, datosTarjeta, datosBilletera } = req.body || {};

    if (!Array.isArray(infraccionesIds) || infraccionesIds.length === 0) {
      return res.status(400).json({ error: 'Debe enviar al menos una infracción para abonar' });
    }

    //verifico que sean todos ObjectId válidos
    const idsValidos = infraccionesIds.every((id: string) => isValidObjectId(id));
    if (!idsValidos) {
      return res.status(400).json({ error: 'Uno o más IDs de infracción son inválidos' });
    }

    // Validación de medio de pago
    if (!medioPago || !['tarjeta', 'billetera_virtual'].includes(medioPago)) {
      return res.status(400).json({
        error: 'Medio de pago inválido. Solo se admiten pagos online: "tarjeta" o "billetera_virtual"',
      });
    }

    if (!pagador?.nombreCompleto || !pagador?.dniCuit) {
      return res.status(400).json({ error: 'Los datos del pagador (nombre completo y DNI/CUIT) son obligatorios' });
    }

    // Busco todos los actas validas en la db
    const objectIdsInfracciones = infraccionesIds.map((id: string) => new Types.ObjectId(id));
    const actas = await InfraccionModel.find({ _id: { $in: objectIdsInfracciones } });

    //chequeo que las actas encontradas sean  igual a las enviadas (cantidad)
    if (actas.length !== infraccionesIds.length) {
      return res.status(404).json({ error: 'Una o más infracciones no fueron encontradas' });
    }

    const actasNoCobrables = actas.filter((a) => a.estado === 'pagada' || a.estado === 'anulada');
    if (actasNoCobrables.length > 0) {
      return res.status(400).json({
        error: 'Una o más actas seleccionadas ya se encuentran abonadas o anuladas',
        detalles: actasNoCobrables.map((a) => a.numeroActa),
      });
    }

    // Validaciones específicas según medio online
    if (medioPago === 'tarjeta') {
      if (
        !datosTarjeta?.numeroTarjeta ||
        !datosTarjeta?.nombreTitular ||
        !datosTarjeta?.emisor ||
        !datosTarjeta?.tipoTarjeta
      ) {
        return res.status(400).json({ error: 'Faltan datos obligatorios de la tarjeta' });
      }
    }

    if (medioPago === 'billetera_virtual') {
      if (!datosBilletera?.proveedor || !datosBilletera?.idTransaccionExterna) {
        return res.status(400).json({
          error: 'Para pagos con billetera virtual debe indicar proveedor e idTransaccionExterna',
        });
      }
    }

    const montoTotalAbonado = actas.reduce((total, acta) => total + acta.monto, 0);
    const numeroComprobante = generarComprobante();

    // Construcción de subdocumentos embebidos 
    // si es tarjeta lo creo , sino undefined
    const datosTarjetaPersistir: IDatosTarjeta | undefined =
      medioPago === 'tarjeta'
        ? {
            tipoTarjeta: datosTarjeta.tipoTarjeta,
            emisor: datosTarjeta.emisor,
            nombreTitular: datosTarjeta.nombreTitular.trim(),
            ultimos4Digitos: datosTarjeta.numeroTarjeta.slice(-4),
            mesExpiracion: datosTarjeta.mesExpiracion,
            anioExpiracion: datosTarjeta.anioExpiracion,
            codigoAutorizacion: `AUT-${Math.floor(100000 + Math.random() * 900000)}`,
          }
        : undefined;

        // si es bv lo creo , sino undefined
    const datosBilleteraPersistir: IDatosBilletera | undefined =
      medioPago === 'billetera_virtual'
        ? {
            proveedor: datosBilletera.proveedor,
            idTransaccionExterna: datosBilletera.idTransaccionExterna.trim(),
            estadoTransaccion: datosBilletera.estadoTransaccion || 'approved',
            detalleEstado: datosBilletera.detalleEstado,
            tipoPago: datosBilletera.tipoPago,
            montoNetoRecibido: datosBilletera.montoNetoRecibido,
            comisionPasarela: datosBilletera.comisionPasarela,
            fechaAprobacionExterna: datosBilletera.fechaAprobacionExterna
              ? new Date(datosBilletera.fechaAprobacionExterna)
              : new Date(),
            emailPagadorPasarela: datosBilletera.emailPagadorPasarela?.trim()?.toLowerCase(),
          }
        : undefined;
//creo pago
    const nuevoPago = await PagoModel.create({
      numeroComprobante,
      infracciones: actas.map((a) => a._id as Types.ObjectId),
      montoTotalAbonado,
      medioPago,
      datosTarjeta: datosTarjetaPersistir,
      datosBilletera: datosBilleteraPersistir,
      pagador: {
        nombreCompleto: pagador.nombreCompleto.trim(),
        dniCuit: pagador.dniCuit.trim(),
        telefono: pagador.telefono?.trim(),
        email: pagador.email?.trim()?.toLowerCase(),
      },
      cajero: new Types.ObjectId(req.user!.id),
      fechaPago: new Date(),
      estado: 'completado',
    });

    // Actualizo actas a pagadas 
    await InfraccionModel.updateMany(
      { _id: { $in: actas.map((a) => a._id) } },
      { $set: { estado: 'pagada' } }
    );

    // Auditoría
    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Pago',
        entidadId: nuevoPago._id.toString(),
        accion: 'CREACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosNuevos: nuevoPago.toObject(),
        motivo: `Emisión de comprobante ${numeroComprobante} para ${actas.length} acta(s)`,
        ip: req.ip,
      });
    }

    res.status(201).json({
      message: 'Pago procesado exitosamente',
      pago: nuevoPago,
      cantidadActas: actas.length,
    });
  } catch (error) {
    next(error);
  }
};

// 2. GET /pagos -> Listado con filtros (medioPago, rango de fechas, comprobante y nombre de cajero)
export const getPagos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medioPago, fechaDesde, fechaHasta, comprobante, cajeroNombre } = req.query;
    const filtro: Record<string, any> = { estado: { $ne: 'anulado' } };

    if (medioPago && ['tarjeta', 'billetera_virtual'].includes(medioPago as string)) {
      filtro.medioPago = medioPago;
    }

    if (fechaDesde || fechaHasta) {
      filtro.fechaPago = {};
      if (fechaDesde) {
        filtro.fechaPago.$gte = new Date(fechaDesde as string);
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta as string);
        hasta.setHours(23, 59, 59, 999);
        filtro.fechaPago.$lte = hasta;
      }
    }

    if (comprobante && typeof comprobante === 'string') {
      filtro.numeroComprobante = { $regex: comprobante.trim(), $options: 'i' };
    }

    if (cajeroNombre && typeof cajeroNombre === 'string') {
      const cajerosCoincidentes = await UserModel.find({
        nombre: { $regex: cajeroNombre.trim(), $options: 'i' },
      }).select('_id');

      const cajerosIds = cajerosCoincidentes.map((c) => c._id);
      if (cajerosIds.length === 0) {
        return res.json([]);
      }

      filtro.cajero = { $in: cajerosIds };
    }

    const pagos = await PagoModel.find(filtro)
      .populate('cajero', 'nombre email role')
      .populate('anuladoPor', 'nombre email role')
      .populate({
        path: 'infracciones',
        select: 'numeroActa monto tipoFalta vehiculo',
        populate: { path: 'vehiculo', select: 'patente marca modelo' },
      })
      .sort({ fechaPago: -1 })
      .lean<PagoCompleto[]>();

    res.json(pagos);
  } catch (error) {
    next(error);
  }
};

export const getPago = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID de pago inválido' });
    }

    const pago = await PagoModel.findById(id)
      .populate('cajero', 'nombre email role')
      .populate('anuladoPor', 'nombre email role')
      .populate({
        path: 'infracciones',
        select: 'numeroActa monto tipoFalta lugar estado fechaHora vehiculo',
        populate: { path: 'vehiculo', select: 'patente marca modelo' },
      })
      .lean<PagoCompleto>();

    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.json(pago);
  } catch (error) {
    next(error);
  }
};

//  Anulación y reversión de actas (Exclusivo Admin)
export const cancelPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID de pago inválido' });
    }

    if (!motivo || motivo.trim() === '') {
      return res.status(400).json({ error: 'El motivo de anulación es obligatorio' });
    }
// busco pago
    const pago = await PagoModel.findById(id);
    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (pago.estado === 'anulado') {
      return res.status(400).json({ error: 'El pago ya se encuentra anulado' });
    }

    // imagen del pago antes de la modificación para auditoría
    const snapshotAnterior = pago.toObject();

    // 1. Modificar el pago
    pago.estado = 'anulado';
    pago.motivoAnulacion = motivo.trim();
    pago.fechaAnulacion = new Date();
    pago.anuladoPor = new Types.ObjectId(req.user!.id);
    await pago.save();

    // 2. Revertir las infracciones a 'pendiente' para restituir la deuda
    await InfraccionModel.updateMany(
      { _id: { $in: pago.infracciones } },
      { $set: { estado: 'pendiente' } }
    );

    // 3. Auditoría 
    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Pago',
        entidadId: pago._id.toString(),
        accion: 'CAMBIO_ESTADO',
        usuarioId: new Types.ObjectId(req.user.id),
        datosAnteriores: snapshotAnterior,
        datosNuevos: pago.toObject(),
        motivo: `Anulación de comprobante ${pago.numeroComprobante}: ${motivo.trim()}`,
        ip: req.ip,
      });
    }

    res.json({
      message: 'Pago anulado correctamente. Las actas asociadas volvieron al estado pendiente.',
      pago,
    });
  } catch (error) {
    next(error);
  }
};