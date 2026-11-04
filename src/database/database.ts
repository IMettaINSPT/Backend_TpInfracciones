// src/database.ts
import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    console.log("Empiezo en metodo de conexion..");
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/mi-app';
    await mongoose.connect(mongoUrl);
    console.log('[Base de Datos] Conectada exitosamente a MongoDB');
  } catch (error) {
    console.error('[Base de Datos] Error al conectar a MongoDB:', error);
    process.exit(1);
  }
};