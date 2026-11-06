// src/controller/titularController.ts
import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { TitularModel } from '../models/Titular';
import { VehiculoModel } from '../models/Vehiculo';
import { registrarAuditoria } from '../services/AuditService';

export const createTitular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { esPersonaJuridica, cuit, nombre, apellido, dni, domicilio, email, telefono } = req.body || {};

    if (!nombre || !domicilio || !email) {
      return res.status(400).json({ error: 'Nombre, domicilio y email son obligatorios' });
    }

    if (esPersonaJuridica) {
      if (!cuit || cuit.trim() === '') {
        return res.status(400).json({ error: 'El CUIT es obligatorio para personas jurídicas' });
      }
      const existeCuit = await TitularModel.findOne({ cuit: cuit.trim() });
      if (existeCuit) {
        return res.status(400).json({ error: 'Ya existe un titular registrado con ese CUIT' });
      }
    } else {
      if (!dni || !apellido) {
        return res.status(400).json({ error: 'DNI y apellido son obligatorios para personas físicas' });
      }
      const existeDni = await TitularModel.findOne({ dni: dni.trim() });
      if (existeDni) {
        return res.status(400).json({ error: 'Ya existe un titular registrado con ese DNI' });
      }
    }

    const nuevoTitular = await TitularModel.create({
      esPersonaJuridica: Boolean(esPersonaJuridica),
      cuit: cuit ? cuit.trim() : undefined,
      nombre: nombre.trim(),
      apellido: apellido ? apellido.trim() : undefined,
      dni: dni ? dni.trim() : undefined,
      domicilio: domicilio.trim(),
      email: email.trim().toLowerCase(),
      telefono: telefono ? telefono.trim() : undefined,
    });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular' as any,
        entidadId: nuevoTitular._id.toString(),
        accion: 'CREACION',
        usuarioId: req.user.id,
        datosNuevos: nuevoTitular.toObject(),
        motivo: `Alta de titular ${nuevoTitular.nombre} ${nuevoTitular.apellido || ''}`,
        ip: req.ip,
      });
    }

    res.status(201).json({
      message: 'Titular registrado exitosamente',
      titular: nuevoTitular,
    });
  } catch (error) {
    next(error);
  }
};

export const getTitulares = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { busqueda, esPersonaJuridica } = req.query;
    const filtro: Record<string, any> = {};

    if (esPersonaJuridica !== undefined) {
      filtro.esPersonaJuridica = esPersonaJuridica === 'true';
    }

    if (busqueda && typeof busqueda === 'string') {
      filtro.$or = [
        { dni: { $regex: busqueda.trim(), $options: 'i' } },
        { cuit: { $regex: busqueda.trim(), $options: 'i' } },
        { nombre: { $regex: busqueda.trim(), $options: 'i' } },
        { apellido: { $regex: busqueda.trim(), $options: 'i' } },
      ];
    }

    const titulares = await TitularModel.find(filtro).sort({ createdAt: -1 });
    res.json(titulares);
  } catch (error) {
    next(error);
  }
};

export const getTitularById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    // Usamos el virtual para traer vehículos asociados
    const titular = await TitularModel.findById(id).populate('vehiculos');
    if (!titular) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    res.json(titular);
  } catch (error) {
    next(error);
  }
};

export const updateTitular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    const titular = await TitularModel.findById(id);
    if (!titular) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    const snapshotAnterior = titular.toObject();
    const { domicilio, email, telefono, nombre, apellido } = req.body || {};

    if (domicilio) titular.domicilio = domicilio.trim();
    if (email) titular.email = email.trim().toLowerCase();
    if (telefono !== undefined) titular.telefono = telefono.trim();
    if (nombre) titular.nombre = nombre.trim();
    if (apellido && !titular.esPersonaJuridica) titular.apellido = apellido.trim();

    await titular.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular' as any,
        entidadId: id,
        accion: 'MODIFICACION',
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: titular.toObject(),
        motivo: `Actualización de datos del titular ${titular.nombre}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Titular actualizado exitosamente', titular });
  } catch (error) {
    next(error);
  }
};

export const deleteTitular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    // Control de integridad: no borrar si tiene vehículos vigentes
    const vehiculosAsociados = await VehiculoModel.countDocuments({
      'titulares.titular': id,
      'titulares.fechaBajaRegistro': { $exists: false },
    });

    if (vehiculosAsociados > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar el titular: posee vehículos activos vinculados a su nombre',
      });
    }

    const titular = await TitularModel.findByIdAndDelete(id);
    if (!titular) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular' as any,
        entidadId: id,
        accion: 'ELIMINACION',
        usuarioId: req.user.id,
        datosAnteriores: titular.toObject(),
        motivo: `Baja de titular ${titular.nombre}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Titular eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
};

export const closeTitularidad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, vehiculoId } = req.params as { id: string; vehiculoId: string };
    const { motivo } = req.body || {};

    if (!isValidObjectId(id) || !isValidObjectId(vehiculoId)) {
      return res.status(400).json({ error: 'IDs de titular o vehículo inválidos' });
    }

    const [titular, vehiculo] = await Promise.all([
      TitularModel.findById(id),
      VehiculoModel.findById(vehiculoId),
    ]);

    if (!titular) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Buscamos la asignación activa en el vehículo
    const registroTitularidad = vehiculo.titulares.find(
      (t: any) => t.titular.toString() === id && !t.fechaBajaRegistro
    );

    if (!registroTitularidad) {
      return res.status(400).json({
        error: 'El titular no figura como titular vigente de este vehículo',
      });
    }

    const snapshotAnterior = vehiculo.toObject();

    // Seteamos la fecha de baja en el subdocumento del vehículo
    registroTitularidad.fechaBajaRegistro = new Date();

    await vehiculo.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular' as any,
        entidadId: id,
        accion: 'MODIFICACION',
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: vehiculo.toObject(),
        motivo: motivo || `Cesión/Baja de titularidad sobre vehículo patente ${vehiculo.patente}`,
        ip: req.ip,
      });
    }

    res.json({
      message: 'Baja de titularidad procesada exitosamente',
      vehiculoId: vehiculo._id,
      patente: vehiculo.patente,
      titularId: titular._id,
      fechaBajaRegistro: registroTitularidad.fechaBajaRegistro,
    });
  } catch (error) {
    next(error);
  }
};