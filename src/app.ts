import express, { Request, Response } from 'express';
import cors from 'cors';
import { logger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import userRouter from './routes/UserRouter';
import authRouter from './routes/authRoutes';
import auditRouter from './routes/auditRoutes';
import titularRouter from './routes/titularRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// 1. Logger global (va al principio)
 app.use(logger);

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'API de Infracciones operativa' });
});

// 2. Rutas de la API
app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/audit', auditRouter);
app.use('/titulares', titularRouter);


// 3. Manejador de errores centralizado (va SIEMPRE al final, después de las rutas)
 app.use(errorHandler);

export default app;