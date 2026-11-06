// src/controller/infraccionController.ts
import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { InfraccionModel } from '../models/Infraccion';
import { VehiculoModel } from '../models/Vehiculo';
import { registrarAuditoria } from '../services/AuditService';

// Obtengo codigo de barra y numero unico de aca
const getIdentifieres = (monto: number) => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  const numeroActa = `ACTA-2026-${timestamp}-${random}`;
  const codigoBarras = `0442026${timestamp}${random}${Math.round(monto).toString().padStart(8, '0')}`;
  return { numeroActa, codigoBarras };
};

// 1. POST /infracciones -> Labrar Acta (Exclusivo inspectores)
export const generarInfraccion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vehiculo, tipoFalta, lugar, monto, fechaHora } = req.body || {};

    if (!vehiculo || !isValidObjectId(vehiculo)) {
      return res.status(400).json({ error: 'Debe especificar un ID de vehículo válido' });
    }

    const vehiculoExiste = await VehiculoModel.findById(vehiculo);
    if (!vehiculoExiste) {
      return res.status(404).json({ error: 'El vehículo especificado no existe' });
    }

    if (!tipoFalta || tipoFalta.trim() === '') {
      return res.status(400).json({ error: 'El tipo de falta es obligatorio' });
    }

    if (!lugar || lugar.trim() === '') {
      return res.status(400).json({ error: 'El lugar de la infracción es obligatorio' });
    }

    if (monto === undefined || Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const { numeroActa, codigoBarras } = getIdentifieres(Number(monto));

    const nuevaInfraccion = await InfraccionModel.create({
      numeroActa,
      codigoBarras,
      vehiculo,
      tipoFalta: tipoFalta.trim(),
      lugar: lugar.trim(),
      monto: Number(monto),
      fechaHora: fechaHora ? new Date(fechaHora) : undefined,
      estado: 'pendiente',
      inspector: req.user?.id,
    });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Infraccion',
        entidadId: nuevaInfraccion._id.toString(),
        accion: 'CREACION',
        usuarioId: req.user.id,
        datosNuevos: nuevaInfraccion.toObject(),
        motivo: `Labrado de acta N° ${numeroActa}`,
        ip: req.ip,
      });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const urlPago = `${baseUrl}/pagos/${nuevaInfraccion.numeroActa}`;

    res.status(201).json({
      message: 'Acta de infracción labrada exitosamente',
      infraccion: {
        ...nuevaInfraccion.toObject(),
        urlPago,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. PUT /infracciones/:id/descargo -> Presentar Descargo (Exclusivo administrativo)
export const generarDescargo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivoDescargo } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Infracción no encontrada' });
    }

    if (!motivoDescargo || motivoDescargo.trim() === '') {
      return res.status(400).json({ error: 'El motivo del descargo es obligatorio' });
    }

    const acta = await InfraccionModel.findById(id);
    if (!acta) {
      return res.status(404).json({ error: 'Infracción no encontrada' });
    }

    if (acta.estado === 'pagada') {
      return res.status(400).json({ error: 'No se puede ingresar un descargo sobre un acta ya abonada' });
    }

    if (acta.estado === 'anulada') {
      return res.status(400).json({ error: 'No se puede ingresar un descargo sobre un acta anulada' });
    }

    const snapshotAnterior = acta.toObject();

    acta.estado = 'en descargo';
    acta.motivoDescargo = motivoDescargo.trim();
    await acta.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Infraccion',
        entidadId: acta._id.toString(),
        accion: 'CAMBIO_ESTADO' as any,
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: acta.toObject(),
        motivo: `Descargo interpuesto por el titular: ${motivoDescargo.trim()}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Descargo registrado exitosamente', infraccion: acta });
  } catch (error) {
    next(error);
  }
};

// 3. PUT /infracciones/:id/anular -> Anulación de Acta (Exclusivo administrativo / juez)
export const anularInfraccion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Infracción no encontrada' });
    }

    if (!motivo || motivo.trim() === '') {
      return res.status(400).json({ error: 'El motivo de anulación es obligatorio' });
    }

    const acta = await InfraccionModel.findById(id);
    if (!acta) {
      return res.status(404).json({ error: 'Infracción no encontrada' });
    }

    if (acta.estado === 'pagada') {
      return res.status(400).json({ error: 'No se puede anular un acta que ya fue abonada' });
    }

    const snapshotAnterior = acta.toObject();

    acta.estado = 'anulada';
    await acta.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Infraccion',
        entidadId: acta._id.toString(),
        accion: 'CAMBIO_ESTADO' as any,
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: acta.toObject(),
        motivo: `Anulación de acta: ${motivo.trim()}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Acta anulada exitosamente', infraccion: acta });
  } catch (error) {
    next(error);
  }
};

// 4. GET /infracciones/:id -> Detalle del acta por ID
export const obtenerInfraccionPorId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Infracción no encontrada' });
    }

    const acta = await InfraccionModel.findById(id)
      .populate('vehiculo', 'patente marca modelo')
      .populate('inspector', 'nombre email');

    if (!acta) {
      return res.status(404).json({ error: 'Infracción no encontrada' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const urlPago = `${baseUrl}/pagos/${acta.numeroActa}`;

    res.json({
      ...acta.toObject(),
      urlPago,
    });
  } catch (error) {
    next(error);
  }
};

// 5. GET /infracciones/codigo/:codigo -> Búsqueda rápida por código de barras (caja/ventanilla)
export const obtenerInfraccionPorCodigoBarras = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const codigoParam = req.params.codigo;
    const codigo = Array.isArray(codigoParam) ? codigoParam[0] : codigoParam;

    if (!codigo || codigo.trim() === '') {
      return res.status(400).json({ error: 'Código de barras no provisto' });
    }

    const acta = await InfraccionModel.findOne({ codigoBarras: codigo.trim() })
      .populate('vehiculo', 'patente marca modelo')
      .populate('inspector', 'nombre email');

    if (!acta) {
      return res.status(404).json({ error: 'Infracción no encontrada para el código provisto' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const urlPago = `${baseUrl}/pagos/${acta.numeroActa}`;

    res.json({
      ...acta.toObject(),
      urlPago,
    });
  } catch (error) {
    next(error);
  }
};

// 6. GET /infracciones -> Listado general con filtros opcionales (estado / vehículo)
export const listarInfracciones = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { estado, vehiculo } = req.query;
    const filtro: Record<string, any> = {};

    if (estado) filtro.estado = estado;
    if (vehiculo && isValidObjectId(vehiculo)) filtro.vehiculo = vehiculo;

    const actas = await InfraccionModel.find(filtro)
      .populate('vehiculo', 'patente marca modelo')
      .populate('inspector', 'nombre email')
      .sort({ fechaHora: -1 });

    res.json(actas);
  } catch (error) {
    next(error);
  }
};