// src/controller/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { isValidObjectId, Types } from 'mongoose';
import { UserModel } from '../models/User';
import { PerfilModel } from '../models/Perfil';
import { registrarAuditoria } from '../services/AuditService';

// El sistema tiene un admin general. No permitimos eliminarlo ni degradar su perfil
const getEmailAdminSeeder = (): string => {
  return (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').trim().toLowerCase();
};

// 1. CREATE - Alta de usuario vinculando perfilId 
export const crearUsuario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, perfilId, nombre } = req.body || {};

    if (!email || !password || !perfilId || !nombre) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (!isValidObjectId(perfilId)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }

    const perfilExiste = await PerfilModel.findById(perfilId);
    if (!perfilExiste) {
      return res.status(400).json({ error: 'Perfil no encontrado' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const existingUser = await UserModel.findOne({ email: emailNormalizado });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya se encuentra registrado' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await UserModel.create({
      email: emailNormalizado,
      password: hashedPassword,
      perfilId: new Types.ObjectId(perfilId),
      nombre: nombre.trim(),
    });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Usuario',
        entidadId: newUser._id.toString(),
        accion: 'CREACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosNuevos: {
          email: newUser.email,
          perfilId: newUser.perfilId,
          perfilNombre: perfilExiste.nombre,
          nombre: newUser.nombre,
        },
        motivo: `Alta de usuario con perfil ${perfilExiste.nombre}`,
        ip: req.ip,
      });
    }

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser._id,
        email: newUser.email,
        perfil: {
          id: perfilExiste._id,
          nombre: perfilExiste.nombre,
        },
        nombre: newUser.nombre,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. READ - Listado general de usuarios con su perfil poblado
export const listarUsuarios = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const usuarios = await UserModel.find()
      .select('-password')
      .populate('perfilId', 'nombre descripcion')
      .sort({ createdAt: -1 });

    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

// 3. READ BY ID - Obtener detalle de un usuario para la pantalla de edición
export const obtenerUsuarioPorId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = await UserModel.findById(id)
      .select('-password')
      .populate({
        path: 'perfilId',
        populate: { path: 'permisos', select: 'codigo nombre modulo descripcion' },
      });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuario);
  } catch (error) {
    next(error);
  }
};

// 4. PATCH - Cambiar el perfil (rol) asignado a un usuario
export const actualizarPerfilUsuario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { perfilId, motivo } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!perfilId || !isValidObjectId(perfilId)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }

    const [usuario, nuevoPerfil] = await Promise.all([
      UserModel.findById(id).populate('perfilId', 'nombre'),
      PerfilModel.findById(perfilId),
    ]);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!nuevoPerfil) {
      return res.status(400).json({ error: 'El perfil especificado no existe' });
    }

    // No permitir degradar el perfil del admin configurado por variable de entorno
    if (
      usuario.email.toLowerCase() === getEmailAdminSeeder() &&
      nuevoPerfil.nombre !== 'Admin del Sistema'
    ) {
      return res.status(400).json({
        error: 'No se puede modificar el perfil del administrador general configurado en el entorno',
      });
    }

    const snapshotAnterior = usuario.toObject();
    usuario.perfilId = nuevoPerfil._id;
    await usuario.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Usuario',
        entidadId: id,
        accion: 'MODIFICACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosAnteriores: snapshotAnterior,
        datosNuevos: usuario.toObject(),
        motivo: motivo || `Actualización de perfil a "${nuevoPerfil.nombre}" para el usuario ${usuario.email}`,
        ip: req.ip,
      });
    }

    res.json({
      message: 'Perfil de usuario actualizado exitosamente',
      user: {
        id: usuario._id,
        email: usuario.email,
        perfil: {
          id: nuevoPerfil._id,
          nombre: nuevoPerfil.nombre,
        },
        nombre: usuario.nombre,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. DELETE - Eliminar usuario
export const eliminarUsuario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { motivo } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'No podés eliminar tu propia cuenta de usuario' });
    }

    const usuario = await UserModel.findById(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (usuario.email.toLowerCase() === getEmailAdminSeeder()) {
      return res.status(400).json({
        error: 'No se puede eliminar la cuenta de administrador general configurada en el entorno',
      });
    }

    const snapshotAnterior = usuario.toObject();
    await UserModel.findByIdAndDelete(id);

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Usuario',
        entidadId: id,
        accion: 'ELIMINACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosAnteriores: snapshotAnterior,
        motivo: motivo || `Baja del usuario ${usuario.email}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
};