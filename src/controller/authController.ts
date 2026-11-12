import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { Types } from 'mongoose';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    //asersion no nula, basicamente le decimos a typescript que no es undefined y es string (esto porque lo puse opcicion)
    if (!email || !password) {
      return res.status(400).json({ error: 'Debe ingresar email y contraseña' });
    }

    const user = await UserModel.findOne({ email }).populate<{
      perfilId: { _id: Types.ObjectId; nombre: string; permisos: Types.ObjectId[] };
    }>('perfilId');

    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const secret = process.env.JWT_SECRET || 'secreto_desarrollo_123';
    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        perfilId: user.perfilId._id.toString(),
        permisos: user.perfilId.permisos.map((id) => id.toString()), // Array de ObjectIds de Permiso
      },
      secret,
      { expiresIn: '2h' }
    );

    res.json({ message: 'Login exitoso', token });
  } catch (error) {
    next(error);
  }
};