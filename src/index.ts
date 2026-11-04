// src/index.ts
import app from './app';
import dotenv from 'dotenv'
dotenv.config({ path: '.env.development' });
import { connectDB } from './database/database';

const PORT = Number(process.env.PORT) || 4000;

const startServer = async () => {
  console.log("Empieza conexion..");
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Servidor] Corriendo en http://localhost:${PORT}`);
  });
};

startServer();