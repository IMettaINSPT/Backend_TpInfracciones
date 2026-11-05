import { Request, Response, NextFunction } from 'express';
import { logErrorToFile } from '../utils/fileLogger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // 1. Log en archivo de texto físico (Requisito de la consigna)
  logErrorToFile(err, req);

  // 2. Log en la terminal para desarrollo
  console.error(`[Error capturado]: ${err.message}`);

  // 3. Determinar código de estado HTTP
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  // 4. Respuesta estructurada y limpia hacia el cliente (sin filtrar stack trace)
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).json({
    error: err.message || 'Error interno del servidor',
    statusCode,
  });
};