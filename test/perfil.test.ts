import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { PerfilModel } from '../src/models/Perfil';
import { AuditLogModel } from '../src/models/AuditLog';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Módulo de Perfiles y Permisos - Tests de Integración y Cobertura', () => {
  let auth: TestAuthContext;

  beforeEach(async () => {
    auth = await setupTestAuth();
  });

  // 1. CONSULTAS (GET /perfiles y GET /perfiles/permisos)
  describe('Consultas de Perfiles y Catálogo de Permisos', () => {
    it('GET /perfiles debe listar todos los perfiles con sus permisos poblados (200)', async () => {
      const res = await request(app)
        .get('/perfiles')
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(res.body[0].permisos)).toBe(true);
    });

    it('GET /perfiles/permisos debe devolver el catálogo completo de permisos ordenados por módulo (200)', async () => {
      const res = await request(app)
        .get('/perfiles/permisos')
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('codigo');
      expect(res.body[0]).toHaveProperty('modulo');
    });

    it('debe responder 403 si un usuario sin permiso perfiles:gestionar intenta listar perfiles', async () => {
      const res = await request(app)
        .get('/perfiles')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(403);
    });

    it('debe responder 401 si no se envía token de autenticación', async () => {
      const res = await request(app).get('/perfiles');
      expect(res.status).toBe(401);
    });
  });

  // 2. CREACIÓN DE PERFILES (POST /perfiles)
  describe('POST /perfiles (crearPerfil)', () => {
    it('debe crear un perfil personalizado con permisos válidos y registrar auditoría (201)', async () => {
      const payload = {
        nombre: 'Supervisor de Caja',
        descripcion: 'Puede ver panel, cobrar y anular pagos',
        permisos: [
          auth.permisosMap['panel:ver'],
          auth.permisosMap['pago:crear'],
          auth.permisosMap['pago:anular'],
        ],
      };

      const res = await request(app)
        .post('/perfiles')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.perfil).toHaveProperty('nombre', 'Supervisor de Caja');
      expect(res.body.perfil.permisos).toHaveLength(3);

      const log = await AuditLogModel.findOne({
        entidad: 'Perfil',
        entidadId: res.body.perfil._id,
        accion: 'CREACION',
      });
      expect(log).not.toBeNull();
    });

    it('debe responder 400 si falta el nombre o está vacío', async () => {
      const res = await request(app)
        .post('/perfiles')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ nombre: '   ', permisos: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('nombre');
    });

    it('debe responder 400 si ya existe un perfil con ese nombre', async () => {
      const res = await request(app)
        .post('/perfiles')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ nombre: 'Inspector', permisos: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ya existe un perfil');
    });

    it('debe responder 400 si se envía un ID de permiso con formato inválido o inexistente', async () => {
      const resFormatoInvalido = await request(app)
        .post('/perfiles')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ nombre: 'Perfil Roto 1', permisos: ['id-no-valido'] });

      expect(resFormatoInvalido.status).toBe(400);

      const idInexistente = new mongoose.Types.ObjectId().toString();
      const resInexistente = await request(app)
        .post('/perfiles')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ nombre: 'Perfil Roto 2', permisos: [idInexistente] });

      expect(resInexistente.status).toBe(400);
      expect(resInexistente.body.error).toContain('no existen');
    });
  });

  // 3. ACTUALIZACIÓN DE PERMISOS EN PERFIL (PATCH /perfiles/:id/permisos)
  describe('PATCH /perfiles/:id/permisos (actualizarPermisosPerfil)', () => {
    it('debe actualizar permisos, nombre y descripción de un perfil custom y auditar (200)', async () => {
      const perfilCustom = await PerfilModel.create({
        nombre: 'Auditor Externo',
        descripcion: 'Solo lectura inicial',
        permisos: [auth.permisosMap['panel:ver']],
        esSistema: false,
      });

      const res = await request(app)
        .patch(`/perfiles/${perfilCustom._id}/permisos`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          nombre: 'Auditor Senior',
          descripcion: 'Acceso a panel y logs de auditoría',
          permisos: [auth.permisosMap['panel:ver'], auth.permisosMap['auditoria:ver']],
          motivo: 'Ampliación de alcance de auditoría',
        });

      expect(res.status).toBe(200);
      expect(res.body.perfil.nombre).toBe('Auditor Senior');
      expect(res.body.perfil.permisos).toHaveLength(2);

      const log = await AuditLogModel.findOne({
        entidad: 'Perfil',
        entidadId: perfilCustom._id.toString(),
        accion: 'MODIFICACION',
      });
      expect(log).not.toBeNull();
    });

    it('debe responder 404 si el ID del perfil no es válido o no existe', async () => {
      const resInvalido = await request(app)
        .patch('/perfiles/id-invalido-123/permisos')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ permisos: [] });
      expect(resInvalido.status).toBe(404);

      const idInexistente = new mongoose.Types.ObjectId().toString();
      const resNoExiste = await request(app)
        .patch(`/perfiles/${idInexistente}/permisos`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ permisos: [] });
      expect(resNoExiste.status).toBe(404);
    });

    it('debe responder 400 si permisos no es un array o contiene IDs inválidos/inexistentes', async () => {
      const resNoArray = await request(app)
        .patch(`/perfiles/${auth.inspectorPerfilId}/permisos`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ permisos: 'no-es-array' });
      expect(resNoArray.status).toBe(400);

      const resIdInvalido = await request(app)
        .patch(`/perfiles/${auth.inspectorPerfilId}/permisos`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ permisos: ['mal-id'] });
      expect(resIdInvalido.status).toBe(400);

      const idInexistente = new mongoose.Types.ObjectId().toString();
      const resNoExiste = await request(app)
        .patch(`/perfiles/${auth.inspectorPerfilId}/permisos`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ permisos: [idInexistente] });
      expect(resNoExiste.status).toBe(400);
    });

    it('debe impedir quitar el permiso perfiles:gestionar al perfil Admin del Sistema (400)', async () => {
      const res = await request(app)
        .patch(`/perfiles/${auth.adminPerfilId}/permisos`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          permisos: [auth.permisosMap['panel:ver']], // Sin 'perfiles:gestionar'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Admin del Sistema');
    });
  });
});