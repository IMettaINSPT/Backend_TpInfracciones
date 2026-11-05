// src/controller/auditController.ts
import { Request, Response, NextFunction } from 'express';
import { AuditLogModel } from '../models/AuditLog';

// 1. Historial por rango de fechas y entidad (para reportes o filtros generales)
export const obtenerHistorialPorFiltro = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidad, fechaDesde, fechaHasta, accion } = req.query;
    const filtro: Record<string, any> = {};

    if (entidad) {
      filtro.entidad = entidad;
    }

    if (accion) {
      filtro.accion = accion;
    }

    // Filtro por rango de fechas sobre createdAt
    if (fechaDesde || fechaHasta) {
      filtro.createdAt = {};
      if (fechaDesde) {
        filtro.createdAt.$gte = new Date(fechaDesde as string);
      }
      if (fechaHasta) {
        // Fin del día para incluir los registros hasta las 23:59:59
        const hasta = new Date(fechaHasta as string);
        hasta.setHours(23, 59, 59, 999);
        filtro.createdAt.$lte = hasta;
      }
    }

    const logs = await AuditLogModel.find(filtro)
      .populate('usuario', 'nombre email role')
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    next(error);
  }
};

// 2. Historial específico por ID de entidad (cuando seleccionás un registro puntual en una grilla)
export const obtenerHistorialPorEntidadId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidad, id } = req.params;

    const logs = await AuditLogModel.find({ entidad: entidad as any, entidadId: id })
      .populate('usuario', 'nombre email role')
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    next(error);
  }
};

//3. Historia general de todos los logs (para auditoría administrativa, sin filtros)
export const obtenerTodosLosLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accion, entidad } = req.query;
    const filtro: Record<string, any> = {};

    if (accion) filtro.accion = accion;
    if (entidad) filtro.entidad = entidad;

    const logs = await AuditLogModel.find(filtro)
      .populate('usuario', 'nombre email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(logs);
  } catch (error) {
    next(error);
  }
};