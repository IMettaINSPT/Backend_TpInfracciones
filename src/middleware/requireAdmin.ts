import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Se asume que requireAuth ya validó el token y pobló req.user
  if (!req.user || req.user.role !== 'administrativo') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de administrador' });
  }
  
  next();
};