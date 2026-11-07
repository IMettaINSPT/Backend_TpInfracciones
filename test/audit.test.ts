import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import app from '../src/app';
import { AuditLogModel } from '../src/models/AuditLog';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('AuditController - Control de Acceso Exclusivo para Admin', () => {
  let auth: TestAuthContext;
  const dummyEntidadId = new Types.ObjectId().toString();

  beforeEach(async () => {
    auth = await setupTestAuth();
    await AuditLogModel.deleteMany({});

    // Carga de logs base vinculados al adminId
    await AuditLogModel.create([
      {
        entidad: 'Titular',
        entidadId: dummyEntidadId,
        accion: 'CREACION',
        usuarioId: auth.adminId,
        motivo: 'Alta de prueba para auditoría',
        ip: '127.0.0.1',
        createdAt: new Date(),
      },
      {
        entidad: 'Vehiculo',
        entidadId: new Types.ObjectId().toString(),
        accion: 'MODIFICACION',
        usuarioId: auth.adminId,
        motivo: 'Cambio de titular de prueba',
        ip: '127.0.0.1',
        createdAt: new Date(),
      },
    ]);
  });

  describe('Permisos y Restricciones de Acceso (RBAC)', () => {
    it('debe responder 403 si un administrativo intenta ver auditorías', async () => {
      const res = await request(app)
        .get('/audit/logs')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(403);
    });

    it('debe responder 403 si un inspector intenta ver auditorías', async () => {
      const res = await request(app)
        .get(`/audit/historial/Titular/${dummyEntidadId}`)
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(403);
    });

    it('debe responder 401 si no se envía token de autenticación', async () => {
      const res = await request(app).get('/audit/logs');
      expect(res.status).toBe(401);
    });
  });

  describe('Consultas Habilitadas para Rol Admin (200)', () => {
    it('el admin debe poder filtrar logs por rango de fechas y entidad (200)', async () => {
      const hoy = new Date();
      const fechaDesde = new Date(hoy.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const fechaHasta = new Date(hoy.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const res = await request(app)
        .get(`/audit/historial?entidad=Titular&accion=CREACION&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].entidad).toBe('Titular');
    });

    it('el admin debe poder ver el historial específico por entidad e ID (200)', async () => {
      const res = await request(app)
        .get(`/audit/historial/Titular/${dummyEntidadId}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].entidadId).toBe(dummyEntidadId);
    });

    it('el admin debe poder listar todos los logs del sistema (200)', async () => {
      const res = await request(app)
        .get('/audit/logs')
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });
});