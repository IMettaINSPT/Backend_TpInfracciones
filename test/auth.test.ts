// tests/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { UserModel } from '../src/models/User';
import bcrypt from 'bcrypt';

describe('Autenticación y Gestión de Usuarios', () => {
  let adminToken: string;

  // Creamos un admin inicial en la base de datos en memoria antes de correr los tests
  beforeAll(async () => {
    await UserModel.deleteMany({}); // Limpiamos la colección para evitar duplicados
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    const adminUser = await UserModel.create({
      email: 'admin_test@api.com',
      password: hashedPassword,
      role: 'administrativo',
      nombre: 'Admin Test'
    });

    // Hacemos login previo para obtener el token del admin
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin_test@api.com',
        password: 'Admin123!'
      });

    adminToken = loginRes.body.token;
  });

  // 1. Test para Login exitoso
  it('POST /auth/login con credenciales válidas debe responder 200 y devolver un token JWT', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin_test@api.com',
        password: 'Admin123!'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(typeof response.body.token).toBe('string');
  });

  // 2. Test para Login con credenciales inválidas
  it('POST /auth/login con contraseña incorrecta debe responder 401', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin_test@api.com',
        password: 'PasswordFalsa'
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  // 3. Test para Creación de Usuario por parte de un Administrador
  it('POST /users debe permitir a un admin crear un nuevo usuario (inspector)', async () => {
    const newUser = {
      email: 'inspector_nuevo@api.com',
      password: 'Inspector123!',
      role: 'inspector',
      nombre: 'Juan Inspector'
    };

    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`) // Enviamos el token del admin
      .send(newUser);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'Usuario creado exitosamente');
    expect(response.body.user).toHaveProperty('email', newUser.email);
    expect(response.body.user).not.toHaveProperty('password'); // Nunca debe retornar el hash
  });

});