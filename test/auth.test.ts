// test/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Autenticación y Login - Tests de Integración', () => {
  let auth: TestAuthContext;
  const SEED_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').toLowerCase();

  beforeEach(async () => {
    //centralizo la creación de tokens y usuarios de prueba para los distintos roles, para no repetir código en cada test
    auth = await setupTestAuth();
  });

  it('POST /auth/login con credenciales correctas debe responder 200 y devolver un JWT válido', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: SEED_EMAIL,
        password: 'Password123!', // Clave generada por el helper
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /auth/login con contraseña incorrecta debe responder 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: SEED_EMAIL,
        password: 'PasswordErronea123!',
      });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /auth/login con usuario que no existe debe responder 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'noexiste@infracciones.gob.ar',
        password: 'Password123!',
      });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});