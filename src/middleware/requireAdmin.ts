// src/middleware/requireAdmin.ts
import { Response, NextFunction } from 'express';

export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  console.log('usurioo:' , req.user);
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol de administrador' });
  }
  next();
};