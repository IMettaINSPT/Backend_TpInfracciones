import { Request, Response, NextFunction } from 'express';
import { PermisoModel } from '../models/Permiso';

// Caché en memoria: codigo -> _id.toString() de MongoDB
let permisosGuardados = new Map<string, string>();

export const refrescarCachePermisos = async () => {
  const permisos = await PermisoModel.find().select('_id codigo').lean();
  permisosGuardados = new Map(permisos.map((p) => [p.codigo, p._id.toString()]));
};

export const requirePermission = (codigoPermiso: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Si la caché está vacía (ej. primer request en tests), la hidrata desde MongoDB
    if (!permisosGuardados.has(codigoPermiso)) {
      await refrescarCachePermisos();
    }

    const permisoObjectId = permisosGuardados.get(codigoPermiso);
    if (!permisoObjectId || !req.user.permisos?.includes(permisoObjectId)) {
      return res.status(403).json({ error: 'Acceso denegado: Permisos insuficientes' });
    }

    next();
  };
};