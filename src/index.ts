// src/index.ts
import app from './app';
import { connectDB } from './database/database';
import { runInitialSeeder } from './database/seeder';
const PORT = Number(process.env.PORT) || 4000;

const startServer = async () => {
  console.log("Empieza conexion..");
  await connectDB();
  await runInitialSeeder();

  app.listen(PORT, () => {
    console.log(`[Servidor] Corriendo en http://localhost:${PORT}`);
  });
};

startServer();