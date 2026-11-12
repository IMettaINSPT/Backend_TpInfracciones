import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { UserModel } from '../src/models/User';
import { PerfilModel } from '../src/models/Perfil';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('ABM de Usuarios y Perfiles Dinámicos - Tests de Integración', () => {
  let auth: TestAuthContext;
  const SEED_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').toLowerCase();
  const JWT_SECRET = process.env.JWT_SECRET || 'secreto_testing_123';

  beforeEach(async () => {
    auth = await setupTestAuth();
  });

  // 1. CREACIÓN DE USUARIOS (POST /users)
  describe('POST /users (crearUsuario)', () => {
    it('debe crear un usuario vinculando un perfilId válido y devolver 201 sin contraseña', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          email: 'nuevo.inspector@infracciones.gob.ar',
          password: 'Password123!',
          perfilId: auth.inspectorPerfilId,
          nombre: 'Carlos Inspector',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('email', 'nuevo.inspector@infracciones.gob.ar');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('debe responder 400 si se envía un perfilId con formato inválido o inexistente', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          email: 'perfil.invalido@infracciones.gob.ar',
          password: 'Password123!',
          perfilId: idInexistente,
          nombre: 'Perfil Inexistente',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Perfil');
    });

    it('debe responder 403 si un inspector intenta crear un usuario', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({
          email: 'test@infracciones.gob.ar',
          password: 'Password123!',
          perfilId: auth.inspectorPerfilId,
          nombre: 'Prueba',
        });

      expect(res.status).toBe(403);
    });
  });

  // 2. LISTADO DE USUARIOS (GET /users)
  describe('GET /users (listarUsuarios)', () => {
    it('debe devolver los usuarios con su perfil poblado y sin contraseña (200)', async () => {
      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((u: any) => {
        expect(u).not.toHaveProperty('password');
        expect(u).toHaveProperty('perfilId');
      });
    });
  });

  // 3. ACTUALIZACIÓN DE PERFIL DE USUARIO (PATCH /users/:id/perfil)
  describe('PATCH /users/:id/perfil (actualizarPerfilUsuario)', () => {
    it('debe permitir cambiar el perfil de un usuario existente (200)', async () => {
      const usuario = await UserModel.create({
        email: 'cambio.perfil@infracciones.gob.ar',
        password: 'hash',
        perfilId: auth.inspectorPerfilId,
        nombre: 'Para Cambiar',
      });

      const res = await request(app)
        .patch(`/users/${usuario._id}/perfil`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ perfilId: auth.administrativoPerfilId, motivo: 'Pase a planta administrativa' });

      expect(res.status).toBe(200);
      const actualizado = await UserModel.findById(usuario._id);
      expect(actualizado?.perfilId.toString()).toBe(auth.administrativoPerfilId);
    });

    it('debe impedir cambiar el perfil del admin general del seeder (400)', async () => {
      const res = await request(app)
        .patch(`/users/${auth.adminId}/perfil`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ perfilId: auth.inspectorPerfilId });

      expect(res.status).toBe(400);
    });
  });

  // 4. ELIMINACIÓN DE USUARIOS (DELETE /users/:id)
  describe('DELETE /users/:id (eliminarUsuario)', () => {
    it('debe impedir que el administrador se elimine a sí mismo (400)', async () => {
      const res = await request(app)
        .delete(`/users/${auth.adminId}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(400);
    });

    it('debe impedir eliminar al usuario seeder configurado en el entorno (400)', async () => {
      const otroAdmin = await UserModel.create({
        email: 'segundo.admin@infracciones.gob.ar',
        password: 'hash',
        perfilId: auth.adminPerfilId,
        nombre: 'Segundo Admin',
      });

      const segundoAdminToken = jwt.sign(
        {
          id: otroAdmin._id.toString(),
          email: otroAdmin.email,
          perfilId: auth.adminPerfilId,
          permisos: Object.values(auth.permisosMap),
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .delete(`/users/${auth.adminId}`)
        .set('Authorization', `Bearer ${segundoAdminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // 5. CONTROL DINÁMICO DE PERMISOS POR PERFIL
  describe('PATCH /perfiles/:id/permisos (Segregación dinámica)', () => {
    it('debe revocar el acceso a un endpoint cuando se quita el permiso del perfil y el usuario reingresa', async () => {
      // Creamos perfil custom con permiso 'usuarios:gestionar'
      const perfilCustom = await PerfilModel.create({
        nombre: 'Supervisor Temporal',
        permisos: [auth.permisosMap['usuarios:gestionar']],
      });

      const passHash = await bcrypt.hash('Temp123!', 10);
      await UserModel.create({
        email: 'supervisor@infracciones.gob.ar',
        password: passHash,
        perfilId: perfilCustom._id,
        nombre: 'Supervisor',
      });

      // Login 1: tiene permiso -> GET /users responde 200
      const login1 = await request(app)
        .post('/auth/login')
        .send({ email: 'supervisor@infracciones.gob.ar', password: 'Temp123!' });
      const resOk = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${login1.body.token}`);
      expect(resOk.status).toBe(200);

      // Admin le quita 'usuarios:gestionar' al perfil
      const patchRes = await request(app)
        .patch(`/perfiles/${perfilCustom._id}/permisos`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ permisos: [auth.permisosMap['panel:ver']] });
      expect(patchRes.status).toBe(200);

      // Login 2: ya no tiene el permiso en su JWT -> GET /users responde 403
      const login2 = await request(app)
        .post('/auth/login')
        .send({ email: 'supervisor@infracciones.gob.ar', password: 'Temp123!' });
      const resDenied = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${login2.body.token}`);
      expect(resDenied.status).toBe(403);
    });
  });
});