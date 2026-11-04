// src/database/seeder.ts
import bcrypt from 'bcrypt';
import { UserModel } from '../models/User';

export const runInitialSeeder = async () => {
  try {
    // 1. Verificamos si ya existen usuarios en la base de datos
    const userCount = await UserModel.countDocuments();
    
    // Si la base no está vacía, no hacemos nada y salimos
    if (userCount > 0) {
      console.log('[Seeder] La base de datos ya contiene usuarios. Seeding omitido.');
      return;
    }

    console.log('[Seeder] Base de datos vacía detectada. Creando usuario administrador inicial...');

    // 2. Hasheamos la contraseña hasheada por defecto 
    const saltRounds = 10;
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123!';
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

    // 3. Insertamos el documento en MongoDB
    await UserModel.create({
      email: 'admin@infracciones.gob.ar',
      password: hashedPassword,
      role: 'administrativo', // El rol requerido para la creación de futuros usuarios
      nombre: 'Administrador General del Sistema'
    });

    console.log('[Seeder] Usuario administrador creado exitosamente.');
    console.log(`[Seeder] Credenciales iniciales -> Email: admin@infracciones.gob.ar | Password: ${defaultPassword}`);

  } catch (error) {
    console.error('[Seeder] Fallo al ejecutar la migración inicial:', error);
  }
};