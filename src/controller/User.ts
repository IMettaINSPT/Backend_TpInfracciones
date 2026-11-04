import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {UserModel} from '../models/User'; 

export const crearUsuario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role, nombre } = req.body;

    // 1. Validar que el usuario no exista previamente
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya se encuentra registrado' });
    }

    // 2. Hashear la contraseña antes de guardarla
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Crear el documento en MongoDB
    const newUser = await UserModel.create({
      email,
      password: hashedPassword,
      role,
      nombre,
    });

    // 4. Devolver la respuesta limpiando el campo de la contraseña por seguridad
    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        nombre: newUser.nombre
      }
    });
  } catch (error) {
    next(error); // Deriva fallos al middleware de error
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    const user = await UserModel.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const secret = process.env.JWT_SECRET || 'secreto_desarrollo_123';
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      secret,
      { expiresIn: '2h' }
    );

    res.json({ message: 'Login exitoso', token });
  } catch (error) {
    next(error); // Deriva el fallo al manejador de errores centralizado
  }
};