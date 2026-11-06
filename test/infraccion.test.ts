import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { VehiculoModel } from '../src/models/Vehiculo';
import { InfraccionModel } from '../src/models/Infraccion';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Entidad Infraccion - Tests de Integración', () => {
  let auth: TestAuthContext;
  let vehiculoId: string;

  beforeEach(async () => {
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
    it('un inspector debe poder labrar un acta de infracción exitosamente (201)', async () => {
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
      // Validamos los campos de negocio y verificamos que se autogeneren número y código
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
  });

  describe('PUT /infracciones/:id/descargo (generarDescargo)', () => {
    it('un administrativo debe poder presentar un descargo y pasar a estado "en descargo" (200)', async () => {
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
        .send({ motivoDescargo: 'El conductor presentaba emergencia médica acreditada' });

      expect(res.status).toBe(200);
      expect(res.body.infraccion.estado).toBe('en descargo');
      expect(res.body.infraccion.motivoDescargo).toBe('El conductor presentaba emergencia médica acreditada');
    });

    it('debe responder 403 si un inspector intenta generar un descargo', async () => {
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
        .send({ motivoDescargo: 'Intento no permitido' });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /infracciones/:id/anular (anularInfraccion)', () => {
    it('un administrativo debe poder anular un acta pendiente (200)', async () => {
      const acta = await InfraccionModel.create({
        numeroActa: 'ACTA-2026-999999-3333',
        codigoBarras: '0442026999999333300050000',
        vehiculo: vehiculoId,
        tipoFalta: 'Falta de patente delantera',
        lugar: 'Acceso Norte',
        monto: 50000,
        estado: 'pendiente',
        inspector: auth.inspectorId,
      });

      const res = await request(app)
        .put(`/infracciones/${acta._id}/anular`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivo: 'Error en la identificación del rodado por cámara' });

      expect(res.status).toBe(200);
      expect(res.body.infraccion.estado).toBe('anulada');
    });
  });
});