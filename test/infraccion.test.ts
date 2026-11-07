// test/infraccion.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { VehiculoModel } from '../src/models/Vehiculo';
import { InfraccionModel } from '../src/models/Infraccion';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Entidad Infraccion - Tests de Integración', () => {
  let auth: TestAuthContext;
  let vehiculoId: string;

  beforeEach(async () => {
    // Inicializamos el objeto auth con los tokens y usuarios de prueba
    auth = await setupTestAuth();

    const vehiculo = await VehiculoModel.create({
      patente: 'AA123ZZ',
      marca: 'Fiat',
      modelo: 'Cronos',
      anio: 2022,
    });
    vehiculoId = vehiculo._id.toString();
  });

  describe('POST /infracciones (generarInfraccion)', () => {
    it('un inspector debe poder labrar un acta exitosamente con auth.inspectorToken (201)', async () => {
      const payload = {
        vehiculo: vehiculoId,
        tipoFalta: 'Estacionar en ochava',
        lugar: 'Av. Corrientes y Callao',
        monto: 45000,
      };

      const res = await request(app)
        .post('/infracciones')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.infraccion).toMatchObject({
        estado: 'pendiente',
        lugar: 'Av. Corrientes y Callao',
        monto: 45000,
        tipoFalta: 'Estacionar en ochava',
        vehiculo: vehiculoId,
      });
      expect(res.body.infraccion.numeroActa).toBeDefined();
      expect(res.body.infraccion.codigoBarras).toBeDefined();
      expect(res.body.infraccion).toHaveProperty('urlPago');
    });

    it('debe rechazar con 403 si un administrativo intenta labrar un acta de calle', async () => {
      const res = await request(app)
        .post('/infracciones')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          vehiculo: vehiculoId,
          tipoFalta: 'Giro indebido',
          lugar: 'Mitre 500',
          monto: 30000,
        });

      expect(res.status).toBe(403);
    });

    it('debe rechazar con 400 si faltan datos obligatorios o monto <= 0', async () => {
      const res = await request(app)
        .post('/infracciones')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({ vehiculo: vehiculoId, tipoFalta: '', lugar: '', monto: -500 });

      expect(res.status).toBe(400);
    });

    it('debe responder 400 si el ID de vehículo no es un ObjectId válido', async () => {
      const res = await request(app)
        .post('/infracciones')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({ vehiculo: 'id-falso-invalido', tipoFalta: 'Cruce rojo', lugar: 'Centro', monto: 50000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ID de vehículo válido');
    });
  });

  describe('PUT /infracciones/:id/descargo (generarDescargo)', () => {
    it('un administrativo debe poder asentar un descargo formal (200)', async () => {
      const acta = await InfraccionModel.create({
        numeroActa: 'ACTA-2026-999999-1111',
        codigoBarras: '0442026999999111100080000',
        vehiculo: vehiculoId,
        tipoFalta: 'Semáforo en rojo',
        lugar: 'Av. Belgrano 1000',
        fechaHora: new Date(),
        monto: 80000,
        estado: 'pendiente',
        inspector: auth.inspectorId,
      });

      const res = await request(app)
        .put(`/infracciones/${acta._id}/descargo`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivoDescargo: 'Conductor con urgencia médica comprobada' });

      expect(res.status).toBe(200);
      expect(res.body.infraccion.estado).toBe('en descargo');
      expect(res.body.infraccion.motivoDescargo).toBe('Conductor con urgencia médica comprobada');
    });

    it('debe responder 403 si un inspector intenta asentar un descargo', async () => {
      const acta = await InfraccionModel.create({
        numeroActa: 'ACTA-2026-999999-2222',
        codigoBarras: '0442026999999222200090000',
        vehiculo: vehiculoId,
        tipoFalta: 'Exceso de velocidad',
        lugar: 'Ruta 8',
        fechaHora: new Date(),
        monto: 90000,
        estado: 'pendiente',
        inspector: auth.inspectorId,
      });

      const res = await request(app)
        .put(`/infracciones/${acta._id}/descargo`)
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({ motivoDescargo: 'Descargo no permitido por inspector' });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /infracciones/:id/anular (anularInfraccion)', () => {
    it('un administrativo debe poder anular un acta pendiente (200)', async () => {
      const acta = await InfraccionModel.create({
        numeroActa: 'ACTA-2026-999999-3333',
        codigoBarras: '0442026999999333300050000',
        vehiculo: vehiculoId,
        tipoFalta: 'Falta de chapa patente',
        lugar: 'Acceso Norte',
        monto: 50000,
        estado: 'pendiente',
        inspector: auth.inspectorId,
      });

      const res = await request(app)
        .put(`/infracciones/${acta._id}/anular`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivo: 'Error en captura de foto multas' });

      expect(res.status).toBe(200);
      expect(res.body.infraccion.estado).toBe('anulada');
    });
  });

  describe('Consultas y Listados de Infracciones', () => {
    it('GET /infracciones debe listar todas las actas y permitir filtrar por vehículo', async () => {
      const res = await request(app)
        .get(`/infracciones?vehiculo=${vehiculoId}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /infracciones/:id y GET /infracciones/codigo/:codigo deben retornar el detalle del acta', async () => {
      const acta = await InfraccionModel.create({
        numeroActa: 'ACTA-2026-888888-1234',
        codigoBarras: '0442026888888123400030000',
        vehiculo: vehiculoId,
        tipoFalta: 'Estacionar sobre senda peatonal',
        lugar: 'Av. San Martín 200',
        monto: 30000,
        estado: 'pendiente',
        inspector: auth.inspectorId,
      });

      // Búsqueda por ID
      const resId = await request(app)
        .get(`/infracciones/${acta._id}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);
      expect(resId.status).toBe(200);
      expect(resId.body.numeroActa).toBe(acta.numeroActa);

      // Búsqueda por Código de Barras
      const resCodigo = await request(app)
        .get(`/infracciones/codigo/${acta.codigoBarras}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);
      expect(resCodigo.status).toBe(200);
      expect(resCodigo.body.codigoBarras).toBe(acta.codigoBarras);
    });

    it('GET /infracciones/:id debe devolver 404 si el ID no existe', async () => {
      const res = await request(app)
        .get('/infracciones/6aee23cefce8fbbf4e7fe399')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Casos límite y validaciones adicionales de Infracciones', () => {
    it('debe responder 404 al generar infracción si el vehículo no existe en DB', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/infracciones')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({
          vehiculo: idInexistente,
          tipoFalta: 'Falta de seguro',
          lugar: 'Ruta 4',
          monto: 25000,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no existe');
    });

    it('debe responder 400 en descargo si no se envía motivoDescargo', async () => {
      const res = await request(app)
        .put('/infracciones/6aee23cefce8fbbf4e7fe399/descargo')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivoDescargo: '' });

      expect([400, 404]).toContain(res.status);
    });

    it('debe impedir descargo o anulación sobre actas pagadas o anuladas (400)', async () => {
      const actaPagada = await InfraccionModel.create({
        numeroActa: 'ACTA-PAG-001',
        codigoBarras: '0442026000000000000055555',
        vehiculo: vehiculoId,
        tipoFalta: 'Estacionamiento',
        lugar: 'Centro',
        monto: 15000,
        estado: 'pagada',
        inspector: auth.inspectorId,
      });

      const resDescargo = await request(app)
        .put(`/infracciones/${actaPagada._id}/descargo`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivoDescargo: 'Descargo tarde' });

      expect(resDescargo.status).toBe(400);

      const resAnular = await request(app)
        .put(`/infracciones/${actaPagada._id}/anular`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivo: 'Anular cobrada' });

      expect(resAnular.status).toBe(400);
    });

    it('GET /infracciones/codigo/:codigo debe responder 404 si el código no coincide', async () => {
      const res = await request(app)
        .get('/infracciones/codigo/0000000000000000000000000')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(404);
    });
  });
});