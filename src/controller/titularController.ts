// src/controller/titularController.ts
import { Request, Response, NextFunction } from 'express';
import { TitularModel } from '../models/Titular';
import { registrarAuditoria } from '../services/AuditService';
import { isValidObjectId } from 'mongoose';

export const crearTitular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { esPersonaJuridica = false, cuit, nombre, apellido, dni, domicilio, email, telefono } = req.body;

    if (!nombre || nombre.trim() === '') {
      if (esPersonaJuridica) return res.status(400).json({ error: 'La razón social es obligatoria' });
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    if (!domicilio || domicilio.trim() === '') {
      return res.status(400).json({ error: 'El domicilio es obligatorio' });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({ error: 'El email es obligatorio' });
    }

    if (cuit && cuit.trim() !== '') {
      const existeCuit = await TitularModel.findOne({ cuit: cuit.trim() });
      if (existeCuit) return res.status(400).json({ error: 'Ya existe un titular registrado con ese CUIT' });
    }

    if (dni && dni.trim() !== '') {
      const existeDni = await TitularModel.findOne({ dni: dni.trim() });
      if (existeDni) return res.status(400).json({ error: 'Ya existe un titular registrado con ese DNI' });
    }

    const nuevoTitular = await TitularModel.create({
      esPersonaJuridica,
      cuit: cuit ? cuit.trim() : undefined,
      nombre: nombre.trim(),
      apellido: apellido ? apellido.trim() : undefined,
      dni: dni ? dni.trim() : undefined,
      domicilio: domicilio.trim(),
      email: email.trim(),
      telefono: telefono ? telefono.trim() : undefined,
    });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular',
        entidadId: nuevoTitular._id,
        accion: 'CREACION',
        usuarioId: req.user.id,
        datosNuevos: nuevoTitular.toObject(),
        ip: req.ip,
      });
    }

    res.status(201).json({ message: 'Titular creado exitosamente', titular: nuevoTitular });
  } catch (error) {
    next(error);
  }
};

export const obtenerTitulares = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const titulares = await TitularModel.find().sort({ createdAt: -1 });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular',
        entidadId: '000000000000000000000000', // ID neutro o genérico para listar colección
        accion: 'LECTURA' as any,
        usuarioId: req.user.id,
        motivo: `Consulta de listado general de titulares (${titulares.length} registros)`,
        ip: req.ip,
      });
    }

    res.json(titulares);
  } catch (error) {
    next(error);
  }
};

export const obtenerTitularPorId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const titular = await TitularModel.findById(id);

    // Si el ID no tiene formato válido de MongoDB, responde 404 directo
    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }
    if (!titular) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular',
        entidadId: titular._id,
        accion: 'LECTURA' as any,
        usuarioId: req.user.id,
        motivo: `Consulta individual de titular ${titular.nombre}`,
        ip: req.ip,
      });
    }

    res.json(titular);
  } catch (error) {
    next(error);
  }
};

export const actualizarTitular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { domicilio, email, telefono, dni, motivo } = req.body;

    const titularOriginal = await TitularModel.findById(id);
    if (!titularOriginal) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    // Si el ID no tiene formato válido de MongoDB, responde 404 directo
    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    const snapshotAnterior = titularOriginal.toObject();

    if (domicilio) titularOriginal.domicilio = domicilio;
    if (email) titularOriginal.email = email;
    if (telefono) titularOriginal.telefono = telefono;
    if (dni) titularOriginal.dni = dni;

    const titularActualizado = await titularOriginal.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular',
        entidadId: titularActualizado._id,
        accion: 'MODIFICACION',
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: titularActualizado.toObject(),
        motivo: motivo || 'Actualización de datos del titular',
        ip: req.ip,
      });
    }

    res.json({ message: 'Titular actualizado exitosamente', titular: titularActualizado });
  } catch (error) {
    next(error);
  }
};

export const eliminarTitular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { motivo } = req.body || {};
    

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }
    
    const titularOriginal = await TitularModel.findById(id);
    if (!titularOriginal) {
      return res.status(404).json({ error: 'Titular no encontrado' });
    }

    const snapshotAnterior = titularOriginal.toObject();

    await TitularModel.findByIdAndDelete(id);

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Titular',
        entidadId: id, 
        accion: 'ELIMINACION',
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        motivo: motivo || 'Baja definitiva de titular',
        ip: req.ip,
      });
    }

    res.json({ message: 'Titular eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
};  