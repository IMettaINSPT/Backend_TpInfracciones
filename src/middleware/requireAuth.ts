import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserTokenPayload } from '../types';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no provisto o inválido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'secreto123';
    const decoded = jwt.verify(token, secret) as UserTokenPayload;
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};