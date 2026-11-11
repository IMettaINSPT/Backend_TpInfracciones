// src/controller/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { isValidObjectId , Types} from 'mongoose';
import { UserModel } from '../models/User';
import { registrarAuditoria } from '../services/AuditService';


// el sistema tiene un admin general. No permito que se edite 
const getEmailAdminSeeder = (): string => {
  return (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').trim().toLowerCase();
};

const ROLES_PERMITIDOS = ['inspector', 'administrativo', 'admin'];

export const crearUsuario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role, nombre } = req.body || {};

    if (!email || !password || !role || !nombre) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (!ROLES_PERMITIDOS.includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
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
      role,
      nombre: nombre.trim(),
    });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Usuario' ,
        entidadId: newUser._id.toString(),
        accion: 'CREACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosNuevos: { email: newUser.email, role: newUser.role, nombre: newUser.nombre },
        motivo: `Alta de usuario con rol ${newUser.role}`,
        ip: req.ip,
      });
    }

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        nombre: newUser.nombre,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listarUsuarios = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const usuarios = await UserModel.find().select('-password').sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

export const eliminarUsuario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { motivo } = req.body || {};

    if (typeof id !== 'string' || !isValidObjectId(id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'No podés eliminar tu propia cuenta de usuario' });
    }

    const usuario = await UserModel.findById(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Comprobación contra la variable de entorno activa
    if (usuario.email.toLowerCase() === getEmailAdminSeeder()) {
      return res.status(400).json({
        error: 'No se puede eliminar la cuenta de administrador general configurada en el entorno',
      });
    }

    const snapshotAnterior = usuario.toObject();
    await UserModel.findByIdAndDelete(id);

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Usuario' ,
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

export const actualizarRolUsuario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { role, motivo } = req.body || {};

    if (typeof id !== 'string' || !isValidObjectId(id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!role || !ROLES_PERMITIDOS.includes(role)) {
      return res.status(400).json({
        error: `Rol inválido. Los roles permitidos son: ${ROLES_PERMITIDOS.join(', ')}`,
      });
    }

    const usuario = await UserModel.findById(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No permitir cambiar el rol del admin configurado por variable de entorno
    if (usuario.email.toLowerCase() === getEmailAdminSeeder() && role !== 'admin') {
      return res.status(400).json({
        error: 'No se puede modificar el rol del administrador general configurado en el entorno',
      });
    }

    const snapshotAnterior = usuario.toObject();
    usuario.role = role;
    await usuario.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Usuario' ,
        entidadId: id,
        accion: 'MODIFICACION',
        usuarioId: new Types.ObjectId(req.user.id),
        datosAnteriores: snapshotAnterior,
        datosNuevos: usuario.toObject(),
        motivo: motivo || `Actualización de rol a "${role}" para el usuario ${usuario.email}`,
        ip: req.ip,
      });
    }

    res.json({
      message: 'Rol de usuario actualizado exitosamente',
      user: {
        id: usuario._id,
        email: usuario.email,
        role: usuario.role,
        nombre: usuario.nombre,
      },
    });
  } catch (error) {
    next(error);
  }
};