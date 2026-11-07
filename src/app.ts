import express, { Request, Response } from 'express';
import cors from 'cors';
import { logger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import userRouter from './routes/UserRoute';
import authRouter from './routes/authRoute';
import auditRouter from './routes/auditRoute';
import titularRouter from './routes/titularRoute';
import infraccionRouter from './routes/infraccionRoute';
import vehiculoRouter from './routes/vehiculoRoute';
import pagoRouter from './routes/pagoRoute';

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
app.use('/infracciones', infraccionRouter);
app.use('/vehiculos', vehiculoRouter);
app.use('/pagos', pagoRouter);


// 3. Manejador de errores centralizado
 app.use(errorHandler);

export default app;