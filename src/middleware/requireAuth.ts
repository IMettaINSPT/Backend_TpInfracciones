// src/middleware/requireAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// basicamente leo el token del header de la peticion, lo verifico y si es valido, inyecto el usuario en el request para que pueda ser usado en los controladores posteriores
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no provisto o inválido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    // Decodifica y recupera el payload del token firmado
    const decoded = jwt.verify(token, secret);
    
    // Inyecta el usuario desencriptado en el request actual
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Es estrictamente necesario declarar esto para que el compilador no arroje error 
// al intentar asignar propiedades al objeto global Request nativo
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}