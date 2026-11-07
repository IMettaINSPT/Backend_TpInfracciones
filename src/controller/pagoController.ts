// src/controller/pagoController.ts
import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { PagoModel } from '../models/Pago';
import { InfraccionModel } from '../models/Infraccion';
import { registrarAuditoria } from '../services/AuditService';

const generarComprobante = () => {
  const anio = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `REC-${anio}-${random}`;
};

export const registrarPago = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { infraccionesIds, medioPago, pagador, datosTarjeta } = req.body || {};

    if (!Array.isArray(infraccionesIds) || infraccionesIds.length === 0) {
      return res.status(400).json({ error: 'Debe enviar al menos una infracción para abonar' });
    }

    const idsValidos = infraccionesIds.every((id: string) => isValidObjectId(id));
    if (!idsValidos) {
      return res.status(400).json({ error: 'Uno o más IDs de infracción son inválidos' });
    }

    if (!medioPago || !['contado', 'tarjeta'].includes(medioPago)) {
      return res.status(400).json({ error: 'El medio de pago debe ser "contado" o "tarjeta"' });
    }

    if (!pagador?.nombreCompleto || !pagador?.dniCuit) {
      return res.status(400).json({ error: 'Los datos del pagador (nombre completo y DNI/CUIT) son obligatorios' });
    }

    const actas = await InfraccionModel.find({ _id: { $in: infraccionesIds } });
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

    if (medioPago === 'tarjeta') {
      if (!datosTarjeta?.numeroTarjeta || !datosTarjeta?.nombreTitular || !datosTarjeta?.emisor || !datosTarjeta?.tipoTarjeta) {
        return res.status(400).json({ error: 'Faltan datos obligatorios de la tarjeta' });
      }
    }

    const montoTotalAbonado = actas.reduce((total, acta) => total + acta.monto, 0);
    const numeroComprobante = generarComprobante();

    const datosTarjetaPersistir =
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

    const nuevoPago = await PagoModel.create({
      numeroComprobante,
      infracciones: actas.map((a) => a._id),
      montoTotalAbonado,
      medioPago,
      datosTarjeta: datosTarjetaPersistir,
      pagador: {
        nombreCompleto: pagador.nombreCompleto.trim(),
        dniCuit: pagador.dniCuit.trim(),
        telefono: pagador.telefono?.trim(),
        email: pagador.email?.trim()?.toLowerCase(),
      },
      cajero: req.user?.id,
      fechaPago: new Date(),
      estado: 'completado',
    });

    // Pasamos todas las actas cobradas a estado 'pagada'
    await InfraccionModel.updateMany(
      { _id: { $in: actas.map((a) => a._id) } },
      { $set: { estado: 'pagada' } }
    );

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Pago' as any,
        entidadId: nuevoPago._id.toString(),
        accion: 'CREACION',
        usuarioId: req.user.id,
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
export const getPagos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medioPago, fechaDesde, fechaHasta } = req.query;
    const filtro: Record<string, any> = { estado: { $ne: 'anulado' } };

    if (medioPago && ['contado', 'tarjeta'].includes(medioPago as string)) {
      filtro.medioPago = medioPago;
    }

    if (fechaDesde || fechaHasta) {
      filtro.fechaPago = {};
      if (fechaDesde) filtro.fechaPago.$gte = new Date(fechaDesde as string);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta as string);
        hasta.setHours(23, 59, 59, 999);
        filtro.fechaPago.$lte = hasta;
      }
    }

    const pagos = await PagoModel.find(filtro)
      .populate('cajero', 'nombre email')
      .populate({
        path: 'infracciones',
        select: 'numeroActa monto tipoFalta vehiculo',
        populate: { path: 'vehiculo', select: 'patente marca modelo' },
      })
      .sort({ fechaPago: -1 });

    res.json(pagos);
  } catch (error) {
    next(error);
  }
};
export const getPago = async (req: Request, res: Response, next: NextFunction) => {
  try {
  
    const id = req.params.id as string; // <-- Aserción a string primitivo
    let pago;
    if (isValidObjectId(id)) {
      pago = await PagoModel.findById(id);
    } else {
      pago = await PagoModel.findOne({ numeroComprobante: id.toUpperCase().trim() });
    }

    if (!pago) {
      return res.status(404).json({ error: 'Comprobante de pago no encontrado' });
    }

    await pago.populate([
      { path: 'cajero', select: 'nombre email' },
      { path: 'anuladoPor', select: 'nombre email' },
      {
        path: 'infracciones',
        populate: { path: 'vehiculo', select: 'patente marca modelo' },
      },
    ]);

    res.json(pago);
  } catch (error) {
    next(error);
  }
};
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

    const pago = await PagoModel.findById(id);
    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (pago.estado === 'anulado') {
      return res.status(400).json({ error: 'El pago ya se encuentra anulado' });
    }

    const snapshotAnterior = pago.toObject();

    // 1. Modificar el pago
    pago.estado = 'anulado';
    pago.motivoAnulacion = motivo.trim();
    pago.fechaAnulacion = new Date();
    pago.anuladoPor = req.user?.id;
    await pago.save();

    // 2. Revertir las infracciones a 'pendiente' para que vuelvan a registrar deuda
    await InfraccionModel.updateMany(
      { _id: { $in: pago.infracciones } },
      { $set: { estado: 'pendiente' } }
    );

    // 3. Auditoría obligatoria
    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Pago' as any,
        entidadId: pago._id.toString(),
        accion: 'CAMBIO_ESTADO' as any,
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: pago.toObject(),
        motivo: `Anulación de pago comprobante ${pago.numeroComprobante}: ${motivo.trim()}`,
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