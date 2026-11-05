// test/auth.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { UserModel } from '../src/models/User';
import bcrypt from 'bcrypt';

describe('Autenticación y Gestión de Usuarios', () => {
  let adminToken: string;

  // Re-creamos el admin y regeneramos el token antes de cada test para que
  // el afterEach de setup.ts (que vacía la base en memoria) no lo elimine
  beforeEach(async () => {
    await UserModel.deleteMany({});
    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    await UserModel.create({
      email: 'admin_test@api.com',
      password: hashedPassword,
      role: 'administrativo',
      nombre: 'Admin Test',
    });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin_test@api.com',
        password: 'Admin123!',
      });

    adminToken = loginRes.body.token;
  });

  // 1. Login exitoso -> POST /auth/login
  it('POST /auth/login con credenciales válidas debe responder 200 y devolver un token JWT', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin_test@api.com',
        password: 'Admin123!',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(typeof response.body.token).toBe('string');
  });

  // 2. Login inválido -> POST /auth/login
  it('POST /auth/login con contraseña incorrecta debe responder 401', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin_test@api.com',
        password: 'PasswordFalsa',
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  // 3. Crear usuario (admin) -> POST /users
  it('POST /users debe permitir a un admin crear un nuevo usuario (inspector)', async () => {
    const newUser = {
      email: 'inspector_nuevo@api.com',
      password: 'Inspector123!',
      role: 'inspector',
      nombre: 'Juan Inspector',
    };

    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newUser);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'Usuario creado exitosamente');
    expect(response.body.user).toHaveProperty('email', newUser.email);
    expect(response.body.user).not.toHaveProperty('password');
  });
});