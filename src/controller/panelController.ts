import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { PanelService } from '../services/PanelService'; // Con P mayúscula coincidente con el archivo físico
import { IFiltroPeriodo } from '../types';

export const getDeudaPatente = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patente = req.params.patente as string; // Aserción a string primitivo

    if (!patente || patente.trim() === '') {
      return res.status(400).json({ error: 'Debe ingresar una patente válida' });
    }

    const resultado = await PanelService.obtenerDeudaPorPatente(patente);
    if (!resultado) {
      return res.status(404).json({ error: 'Vehículo no encontrado con esa patente' });
    }

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

export const getDeudaTitular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const titularId = req.params.titularId as string; // Aserción limpia a string

    if (!isValidObjectId(titularId)) {
      return res.status(400).json({ error: 'ID de titular inválido' });
    }

    const resultado = await PanelService.obtenerDeudaPorTitular(titularId);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

export const getMetricasPanel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;

    const filtro: IFiltroPeriodo = {};

    // como me llega como string , lo convierto a date
    if (fechaDesde && typeof fechaDesde === 'string') {
      filtro.fechaDesde = new Date(fechaDesde);
    }

    if (fechaHasta && typeof fechaHasta === 'string') {
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999); // Incluir todo el día
      filtro.fechaHasta = hasta;
    }

    const metricas = await PanelService.obtenerMetricasPeriodo(filtro);
    res.json(metricas);
  } catch (error) {
    next(error);
  }
};