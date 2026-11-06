// test/user.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { UserModel } from '../src/models/User';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('ABM de Usuarios - Tests de Integración', () => {
  let auth: TestAuthContext;
  const SEED_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').toLowerCase();

  beforeEach(async () => {
    //centralizo la creación de tokens y usuarios de prueba para los distintos roles, para no repetir código en cada test
    auth = await setupTestAuth();
  });

  // CREACIÓN DE USUARIO (POST /users)
  describe('POST /users (crearUsuario)', () => {
    it('debe permitir a un admin crear un nuevo usuario administrativo exitosamente (201)', async () => {
      const payload = {
        email: 'nuevo.admin@infracciones.gob.ar',
        password: 'PasswordSegura123!',
        role: 'administrativo',
        nombre: 'María Administrativa',
      };

      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Usuario creado exitosamente');
      expect(res.body.user).toMatchObject({
        email: payload.email,
        role: payload.role,
        nombre: payload.nombre,
      });
      expect(res.body.user).not.toHaveProperty('password');

      const guardado = await UserModel.findOne({ email: payload.email });
      expect(guardado).not.toBeNull();
      const coincidePassword = await bcrypt.compare(payload.password, guardado!.password);
      expect(coincidePassword).toBe(true);
    });

    it('debe responder 400 si se intenta crear con un rol inválido', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          email: 'rol.invalido@infracciones.gob.ar',
          password: 'Password123!',
          role: 'gerente',
          nombre: 'Rol Inexistente',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Rol inválido');
    });

    it('debe responder 400 si faltan campos obligatorios', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          email: 'incompleto@infracciones.gob.ar',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Todos los campos son obligatorios');
    });

    it('debe responder 400 si el email ya existe en el sistema', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          email: SEED_EMAIL,
          password: 'Password123!',
          role: 'inspector',
          nombre: 'Duplicado',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('El email ya se encuentra registrado');
    });

    it('debe responder 403 si un inspector intenta crear un usuario', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({
          email: 'test@infracciones.gob.ar',
          password: 'Password123!',
          role: 'inspector',
          nombre: 'Prueba',
        });

      expect(res.status).toBe(403);
    });

    it('debe responder 401 si no se envía token de autenticación', async () => {
      const res = await request(app).post('/users').send({
        email: 'test@infracciones.gob.ar',
        password: 'Password123!',
        role: 'inspector',
        nombre: 'Sin token',
      });

      expect(res.status).toBe(401);
    });
  });

  // LISTADO DE USUARIOS (GET /users)
  describe('GET /users (listarUsuarios)', () => {
    it('debe devolver la lista de usuarios sin exponer el hash de las contraseñas (200)', async () => {
      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      res.body.forEach((u: any) => {
        expect(u).not.toHaveProperty('password');
        expect(u).toHaveProperty('email');
        expect(u).toHaveProperty('role');
      });
    });

    it('debe responder 403 si un usuario sin rol admin intenta listar', async () => {
      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ACTUALIZACIÓN DE ROL
  describe('PATCH /users/:id/role (actualizarRolUsuario)', () => {
    it('debe permitir cambiar el rol de un usuario existente (200)', async () => {
      const res = await request(app)
        .patch(`/users/${auth.inspectorId}/role`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ role: 'administrativo', motivo: 'Pase a planta administrativa' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('administrativo');

      const actualizado = await UserModel.findById(auth.inspectorId);
      expect(actualizado?.role).toBe('administrativo');
    });

    it('debe responder 400 si el rol especificado no es permitido', async () => {
      const res = await request(app)
        .patch(`/users/${auth.inspectorId}/role`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ role: 'superadmin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Rol inválido');
    });

    it('debe responder 400 si se intenta cambiar el rol del admin general del seeder', async () => {
      const res = await request(app)
        .patch(`/users/${auth.adminId}/role`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ role: 'inspector' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('administrador general configurado en el entorno');
    });

    it('debe responder 404 si el ID no corresponde a un usuario existente', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/users/${idInexistente}/role`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Usuario no encontrado');
    });
  });

  // ELIMINACIÓN DE USUARIOS
  describe('DELETE /users/:id (eliminarUsuario)', () => {
    it('debe permitir eliminar un usuario existente (200)', async () => {
      const res = await request(app)
        .delete(`/users/${auth.inspectorId}`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Fin de contrato de prueba' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Usuario eliminado exitosamente');

      const borrado = await UserModel.findById(auth.inspectorId);
      expect(borrado).toBeNull();
    });

    it('debe impedir que el administrador se elimine a sí mismo (400)', async () => {
      const res = await request(app)
        .delete(`/users/${auth.adminId}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No podés eliminar tu propia cuenta de usuario');
    });

    it('debe impedir eliminar al usuario seeder configurado en el entorno (400)', async () => {
      const JWT_SECRET = process.env.JWT_SECRET || 'secreto_testing_123';
      const segundoAdmin = await UserModel.create({
        email: 'segundo.admin@infracciones.gob.ar',
        password: 'hash',
        role: 'admin',
        nombre: 'Segundo Admin',
      });

      const segundoAdminToken = jwt.sign(
        { id: segundoAdmin._id.toString(), email: segundoAdmin.email, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .delete(`/users/${auth.adminId}`)
        .set('Authorization', `Bearer ${segundoAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('administrador general configurada en el entorno');
    });

    it('debe responder 404 si el usuario a eliminar no existe', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/users/${idInexistente}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Usuario no encontrado');
    });
  });
});