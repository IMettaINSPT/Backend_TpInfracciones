import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { Types } from 'mongoose';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Debe ingresar email y contraseña' });
    }

    const user = await UserModel.findOne({ email: email.trim().toLowerCase() }).populate<{
      perfilId: { _id: Types.ObjectId; nombre: string; permisos: Types.ObjectId[] } | null;
    }>('perfilId');

    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Validar que el perfil referenciado exista en la base de datos
    if (!user.perfilId) {
      return res.status(500).json({
        error: 'El usuario no tiene un perfil válido asignado en la base de datos',
      });
    }

    const permisosStrings = user.perfilId.permisos.map((id) => id.toString());
    const secret = process.env.JWT_SECRET || 'secreto_desarrollo_123';

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        perfilId: user.perfilId._id.toString(),
        permisos: permisosStrings,
      },
      secret,
      { expiresIn: '2h' }
    );

    // Devolvemos también `user` para que el AuthContext del frontend lo guarde en localStorage
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        nombre: user.nombre,
        perfil: {
          id: user.perfilId._id.toString(),
          nombre: user.perfilId.nombre,
        },
        permisos: permisosStrings,
      },
    });
  } catch (error) {
    next(error);
  }
};