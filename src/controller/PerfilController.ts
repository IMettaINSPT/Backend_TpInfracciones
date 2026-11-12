import { Request, Response, NextFunction } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { PerfilModel } from '../models/Perfil';
import { PermisoModel } from '../models/Permiso';
import { registrarAuditoria } from '../services/AuditService';

export const listarPerfiles = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const perfiles = await PerfilModel.find()
      .populate('permisos', 'codigo nombre modulo descripcion')
      .sort({ esSistema: -1, nombre: 1 });

    res.json(perfiles);
  } catch (error) {
    next(error);
  }
};

export const listarPermisos = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const permisos = await PermisoModel.find().sort({ modulo: 1, nombre: 1 });
    res.json(permisos);
  } catch (error) {
    next(error);
  }
};

export const crearPerfil = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, descripcion, permisos } = req.body || {};

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre del perfil es obligatorio' });
    }

    const existe = await PerfilModel.findOne({ nombre: nombre.trim() });
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un perfil con ese nombre' });
    }

    const permisosIds: Types.ObjectId[] = [];
    if (Array.isArray(permisos)) {
      for (const pId of permisos) {
        if (!isValidObjectId(pId)) {
          return res.status(400).json({ error: `ID de permiso inválido: ${pId}` });
        }
        permisosIds.push(new Types.ObjectId(pId));
      }

      const cantidadValida = await PermisoModel.countDocuments({ _id: { $in: permisosIds } });
      if (cantidadValida !== permisosIds.length) {
        return res.status(400).json({ error: 'Uno o más permisos especificados no existen' });
      }
    }

    const nuevoPerfil = await PerfilModel.create({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : undefined,
      permisos: permisosIds,
      esSistema: false,
    });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Perfil',
        entidadId: nuevoPerfil._id.toString(),
        accion: 'CREACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosNuevos: nuevoPerfil.toObject(),
        motivo: `Creación de perfil ${nuevoPerfil.nombre}`,
        ip: req.ip,
      });
    }

    const perfilPoblado = await PerfilModel.findById(nuevoPerfil._id).populate(
      'permisos',
      'codigo nombre modulo descripcion'
    );

    res.status(201).json({
      message: 'Perfil creado exitosamente',
      perfil: perfilPoblado,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarPermisosPerfil = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { permisos, nombre, descripcion, motivo } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const perfil = await PerfilModel.findById(id);
    if (!perfil) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    if (!Array.isArray(permisos)) {
      return res.status(400).json({ error: 'El campo permisos debe ser un array de IDs' });
    }

    // Validamos que todos los IDs tengan formato ObjectId y existan en PermisoModel
    const permisosIds: Types.ObjectId[] = [];
    for (const pId of permisos) {
      if (!isValidObjectId(pId)) {
        return res.status(400).json({ error: `ID de permiso inválido: ${pId}` });
      }
      permisosIds.push(new Types.ObjectId(pId));
    }

    const permisosEnDb = await PermisoModel.find({ _id: { $in: permisosIds } });
    if (permisosEnDb.length !== permisosIds.length) {
      return res.status(400).json({ error: 'Uno o más permisos especificados no existen' });
    }

    // Protección: evitar que al perfil "Admin del Sistema" se le quite la gestión de perfiles
    if (perfil.esSistema && perfil.nombre === 'Admin del Sistema') {
      const conservaGestionPerfiles = permisosEnDb.some((p) => p.codigo === 'perfiles:gestionar');
      if (!conservaGestionPerfiles) {
        return res.status(400).json({
          error: 'No se puede quitar el permiso de gestión de perfiles al Admin del Sistema',
        });
      }
    }

    const snapshotAnterior = perfil.toObject();

    perfil.permisos = permisosIds;
    if (nombre && !perfil.esSistema) perfil.nombre = nombre.trim();
    if (descripcion !== undefined) perfil.descripcion = descripcion.trim();

    await perfil.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Perfil',
        entidadId: id,
        accion: 'MODIFICACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosAnteriores: snapshotAnterior,
        datosNuevos: perfil.toObject(),
        motivo: motivo || `Actualización de permisos del perfil ${perfil.nombre}`,
        ip: req.ip,
      });
    }

    const perfilActualizado = await PerfilModel.findById(id).populate(
      'permisos',
      'codigo nombre modulo descripcion'
    );

    res.json({
      message: 'Permisos del perfil actualizados exitosamente',
      perfil: perfilActualizado,
    });
  } catch (error) {
    next(error);
  }
};