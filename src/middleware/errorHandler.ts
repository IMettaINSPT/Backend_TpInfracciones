// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Lo imprimís en TU terminal de Node para enterarte qué pasó
  console.error('[Error interno en consola]:', err);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // 2. Le respondés al cliente ÚNICAMENTE con un JSON limpio
  res.status(statusCode).json({
    error: err.message || 'Error interno del servidor',
  });
};