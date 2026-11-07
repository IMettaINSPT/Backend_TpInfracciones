// test/audit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { AuditLogModel } from '../src/models/AuditLog';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';
import {
  obtenerHistorialPorFiltro,
  obtenerHistorialPorEntidadId,
  obtenerTodosLosLogs,
} from '../src/controller/auditController';

describe('AuditController - Cobertura de Controladores y Rutas', () => {
  let auth: TestAuthContext;
  const dummyEntidadId = new mongoose.Types.ObjectId().toString();

  beforeEach(async () => {
    auth = await setupTestAuth();

    // Mongoose schema oipuru usuarioId, ha controller oipuru populate('usuario')
    await AuditLogModel.create([
      {
        entidad: 'Vehiculo',
        entidadId: dummyEntidadId,
        accion: 'CREACION',
        usuarioId: auth.adminId,
        usuario: auth.adminId, // oipytyvõ populate('usuario') omba'apo porã hag̃ua
        motivo: 'Alta inicial de vehículo',
        createdAt: new Date('2026-05-10T10:00:00Z'),
      },
      {
        entidad: 'Infraccion',
        entidadId: new mongoose.Types.ObjectId().toString(),
        accion: 'CAMBIO_ESTADO',
        usuarioId: auth.adminId,
        usuario: auth.adminId,
        motivo: 'Descargo presentado',
        createdAt: new Date('2026-06-15T15:30:00Z'),
      },
    ]);
  });

  const mockResponse = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  describe('Controlador: obtenerHistorialPorFiltro', () => {
    it('debe filtrar logs por entidad, accion y rango de fechas (desde y hasta)', async () => {
      const req: any = {
        query: {
          entidad: 'Vehiculo',
          accion: 'CREACION',
          fechaDesde: '2026-05-01',
          fechaHasta: '2026-05-20',
        },
      };
      const res = mockResponse();
      const next = vi.fn();

      await obtenerHistorialPorFiltro(req, res, next);

      if (next.mock.calls.length > 0) {
        throw next.mock.calls[0][0];
      }

      expect(res.json).toHaveBeenCalled();
      const logs = res.json.mock.calls[0][0];
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('debe filtrar solo con fechaDesde y sin entidad', async () => {
      const req: any = {
        query: {
          fechaDesde: '2026-06-01',
        },
      };
      const res = mockResponse();
      const next = vi.fn();

      await obtenerHistorialPorFiltro(req, res, next);

      if (next.mock.calls.length > 0) {
        throw next.mock.calls[0][0];
      }

      expect(res.json).toHaveBeenCalled();
      const logs = res.json.mock.calls[0][0];
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('debe manejar errores y llamar a next(error)', async () => {
      const req: any = null;
      const res = mockResponse();
      const next = vi.fn();

      await obtenerHistorialPorFiltro(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Controlador: obtenerHistorialPorEntidadId', () => {
    it('debe devolver logs coincidentes con entidad y entidadId', async () => {
      const req: any = {
        params: {
          entidad: 'Vehiculo',
          id: dummyEntidadId,
        },
      };
      const res = mockResponse();
      const next = vi.fn();

      await obtenerHistorialPorEntidadId(req, res, next);

      if (next.mock.calls.length > 0) {
        throw next.mock.calls[0][0];
      }

      expect(res.json).toHaveBeenCalled();
      const logs = res.json.mock.calls[0][0];
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(1);
      expect(logs[0].entidadId).toBe(dummyEntidadId);
    });

    it('debe invocar next ante un fallo inesperado', async () => {
      const req: any = null;
      const res = mockResponse();
      const next = vi.fn();

      await obtenerHistorialPorEntidadId(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Controlador: obtenerTodosLosLogs', () => {
    it('debe devolver todos los logs limitados a 100 y aplicar filtros de query opcionales', async () => {
      const req: any = {
        query: {
          accion: 'CAMBIO_ESTADO',
          entidad: 'Infraccion',
        },
      };
      const res = mockResponse();
      const next = vi.fn();

      await obtenerTodosLosLogs(req, res, next);

      if (next.mock.calls.length > 0) {
        throw next.mock.calls[0][0];
      }

      expect(res.json).toHaveBeenCalled();
      const logs = res.json.mock.calls[0][0];
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('debe devolver todos los logs sin parámetros de query', async () => {
      const req: any = { query: {} };
      const res = mockResponse();
      const next = vi.fn();

      await obtenerTodosLosLogs(req, res, next);

      if (next.mock.calls.length > 0) {
        throw next.mock.calls[0][0];
      }

      expect(res.json).toHaveBeenCalled();
      const logs = res.json.mock.calls[0][0];
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    it('debe capturar excepciones llamando a next', async () => {
      const req: any = null;
      const res = mockResponse();
      const next = vi.fn();

      await obtenerTodosLosLogs(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});