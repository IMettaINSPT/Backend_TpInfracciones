// src/middleware/logger.ts
import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next(); // ¡Fundamental! Llama a next() para que la petición siga su camino hacia la ruta correspondiente
};