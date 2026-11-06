// test/helpers/auth.helper.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../../src/models/User';

export interface TestAuthContext {
  adminToken: string;
  administrativoToken: string;
  inspectorToken: string;
  adminId: string;
  administrativoId: string;
  inspectorId: string;
}

export const setupTestAuth = async (): Promise<TestAuthContext> => {
  const JWT_SECRET = process.env.JWT_SECRET || 'secreto_testing_123';
  const salt = await bcrypt.hash('Password123!', 10);
  //leo el usuario semilla del .env, si no existe uso un valor por defecto
  const seedEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').toLowerCase();

  // Creamos los tres usuarios base requeridos por el sistema
  const [adminUser, administrativoUser, inspectorUser] = await Promise.all([
    UserModel.create({
      email: seedEmail,
      password: salt,
      role: 'admin',
      nombre: 'Administrador General',
    }),
    UserModel.create({
      email: 'administrativo@infracciones.gob.ar',
      password: salt,
      role: 'administrativo',
      nombre: 'Personal Mesa de Entrada',
    }),
    UserModel.create({
      email: 'inspector.calle@infracciones.gob.ar',
      password: salt,
      role: 'inspector',
      nombre: 'Inspector de Tránsito',
    }),
  ]);

  // Firmamos los tokens correspondientes
  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: adminUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const administrativoToken = jwt.sign(
    { id: administrativoUser._id.toString(), email: administrativoUser.email, role: administrativoUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const inspectorToken = jwt.sign(
    { id: inspectorUser._id.toString(), email: inspectorUser.email, role: inspectorUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return {
    adminToken,
    administrativoToken,
    inspectorToken,
    adminId: adminUser._id.toString(),
    administrativoId: administrativoUser._id.toString(),
    inspectorId: inspectorUser._id.toString(),
  };
};