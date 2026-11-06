// src/database/seeder.ts
import bcrypt from 'bcrypt';
import { UserModel } from '../models/User';

export const runInitialSeeder = async () => {
  try {
    const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const adminNombre = process.env.SEED_ADMIN_NAME || 'Administrador General del Sistema';

    // Comprobamos si el administrador semilla ya existe
    const adminExistente = await UserModel.findOne({ email: adminEmail });
    if (adminExistente) {
      return;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    await UserModel.create({
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      nombre: adminNombre,
    });

    console.log(`[Seeder] Usuario administrador creado exitosamente: ${adminEmail}`);
  } catch (error) {
    console.error('[Seeder] Error al ejecutar la migración inicial:', error);
  }
};