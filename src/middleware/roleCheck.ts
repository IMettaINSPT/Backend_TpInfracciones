import { Request, Response, NextFunction } from 'express';

// acceso a todo el sistema  +  abm usuario
export const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Administrador' });
  }
  next();
};

export const requireInspectorRole = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'inspector' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Inspector' });
  }
  next();
};

export const requireAdministrativeRole = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'administrativo' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Acceso denegado: Se requiere rol Administrativo' });
  }
  next();
};

//en caso de querer validar varios roles, para que cada funcion de rol quede limpia
export const requireRoles = (rolesPermitidos: Array<'inspector' | 'administrativo' | 'admin'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado: Permisos insuficientes' });
    }
    next();
  };
};