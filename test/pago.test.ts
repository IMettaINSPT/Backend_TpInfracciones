import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { PagoModel } from '../src/models/Pago';
import { InfraccionModel } from '../src/models/Infraccion';
import { VehiculoModel } from '../src/models/Vehiculo';
import { TitularModel } from '../src/models/Titular';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Módulo de Pagos - Tests de Integración y Cobertura Completa', () => {
  let auth: TestAuthContext;
  let vehiculoId: string;
  let actaPendiente1Id: string;
  let actaPendiente2Id: string;
  let actaPagadaId: string;
  let actaAnuladaId: string;

  beforeEach(async () => {
    auth = await setupTestAuth();

    await PagoModel.deleteMany({});
    await InfraccionModel.deleteMany({});
    await VehiculoModel.deleteMany({});
    await TitularModel.deleteMany({});

    // Titular y Vehículo
    const titular = await TitularModel.create({
      esPersonaJuridica: false,
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '30111222',
      domicilio: 'Av. Corrientes 1234',
      email: 'juan@test.com',
    });

    const vehiculo = await VehiculoModel.create({
      patente: 'AA123BB',
      marca: 'Fiat',
      modelo: 'Cronos',
      anio: 2023,
      titulares: [{ titular: titular._id, porcentajeTitularidad: 100 }],
    });
    vehiculoId = vehiculo._id.toString();

    // Infracciones en diversos estados
    const acta1 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-0001',
      codigoBarras: '0442026000115000',
      vehiculo: vehiculo._id,
      tipoFalta: 'Exceso de velocidad',
      lugar: 'Av. Libertador 4500',
      monto: 15000,
      estado: 'pendiente',
      inspector: auth.inspectorId,
    });
    actaPendiente1Id = acta1._id.toString();

    const acta2 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-0002',
      codigoBarras: '0442026000225000',
      vehiculo: vehiculo._id,
      tipoFalta: 'Semáforo en rojo',
      lugar: 'Av. 9 de Julio 500',
      monto: 25000,
      estado: 'pendiente',
      inspector: auth.inspectorId,
    });
    actaPendiente2Id = acta2._id.toString();

    const acta3 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-0003',
      codigoBarras: '0442026000310000',
      vehiculo: vehiculo._id,
      tipoFalta: 'Estacionar en ochava',
      lugar: 'San Martín 100',
      monto: 10000,
      estado: 'pagada',
      inspector: auth.inspectorId,
    });
    actaPagadaId = acta3._id.toString();

    const acta4 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-0004',
      codigoBarras: '0442026000412000',
      vehiculo: vehiculo._id,
      tipoFalta: 'Giro indebido',
      lugar: 'Belgrano 800',
      monto: 12000,
      estado: 'anulada',
      inspector: auth.inspectorId,
    });
    actaAnuladaId = acta4._id.toString();
  });

  // -------------------------------------------------------------
  // 1. REGISTRO DE COBROS (POST /pagos)
  // -------------------------------------------------------------
  describe('POST /pagos (crearPago)', () => {
    it('debe registrar un cobro al contado de múltiples actas y actualizar sus estados a pagada (201)', async () => {
      const payload = {
        infraccionesIds: [actaPendiente1Id, actaPendiente2Id],
        medioPago: 'contado',
        pagador: {
          nombreCompleto: 'Juan Gómez',
          dniCuit: '28444555',
          telefono: '1122334455',
          email: 'juan.gomez@test.com',
        },
      };

      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.pago).toBeDefined();
      expect(res.body.pago.numeroComprobante).toMatch(/^REC-/);
      expect(res.body.pago.montoTotalAbonado).toBe(40000);
      expect(res.body.pago.estado).toBe('completado');

      // Verificar persistencia en base de datos
      const acta1 = await InfraccionModel.findById(actaPendiente1Id);
      const acta2 = await InfraccionModel.findById(actaPendiente2Id);
      expect(acta1?.estado).toBe('pagada');
      expect(acta2?.estado).toBe('pagada');
    });

    it('debe registrar un cobro con tarjeta guardando únicamente los últimos 4 dígitos y código de autorización (201)', async () => {
      const payload = {
        infraccionesIds: [actaPendiente1Id],
        medioPago: 'tarjeta',
        datosTarjeta: {
          tipoTarjeta: 'debito',
          emisor: 'visa',
          nombreTitular: 'JUAN PEREZ',
          numeroTarjeta: '4500123456784321',
          codigoSeguridad: '123',
          mesExpiracion: '05',
          anioExpiracion: '2028',
        },
        pagador: {
          nombreCompleto: 'Juan Pérez',
          dniCuit: '30111222',
        },
      };

      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.pago.medioPago).toBe('tarjeta');
      expect(res.body.pago.datosTarjeta.tipoTarjeta).toBe('debito');
      expect(res.body.pago.datosTarjeta.ultimos4Digitos).toBe('4321');
      expect(res.body.pago.datosTarjeta.codigoAutorizacion).toBeDefined();
      expect(res.body.pago.datosTarjeta.numeroTarjeta).toBeUndefined();
      expect(res.body.pago.datosTarjeta.codigoSeguridad).toBeUndefined();
    });

    it('debe responder 403 Forbidden si un inspector intenta efectuar un cobro', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({
          infraccionesIds: [actaPendiente1Id],
          medioPago: 'contado',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(403);
    });

    it('debe responder 400 si el array de infraccionesIds está vacío o ausente', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [],
          medioPago: 'contado',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('al menos una infracción');
    });

    it('debe responder 400 si alguna de las actas ya se encuentra pagada o anulada', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [actaPendiente1Id, actaPagadaId],
          medioPago: 'contado',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('abonadas o anuladas');
    });

    it('debe responder 400 si faltan datos requeridos del pagador o el medio de pago es inválido', async () => {
      const resMedioInvalido = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [actaPendiente1Id],
          medioPago: 'cripto_invalido',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });
      expect(resMedioInvalido.status).toBe(400);

      const resSinPagador = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [actaPendiente1Id],
          medioPago: 'contado',
          pagador: { nombreCompleto: '', dniCuit: '' },
        });
      expect(resSinPagador.status).toBe(400);
    });

   it('debe responder 404 o 400 si se envía un ID de infracción con formato inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [fakeId],
          medioPago: 'contado',
          pagador: { nombreCompleto: 'Test Inexistente', dniCuit: '123' },
        });

      // Tu controlador devuelve 404 al no encontrar el acta en DB
      expect([400, 404]).toContain(res.status);
    });
  });

  // -------------------------------------------------------------
  // 2. CONSULTAS DE PAGOS (GET /pagos y GET /pagos/:id)
  // -------------------------------------------------------------
  describe('GET /pagos y GET /pagos/:id (getPagos / getPagoById)', () => {
    let comprobanteValido: string;
    let pagoValidoId: string;

    beforeEach(async () => {
      const pagoActivo = await PagoModel.create({
        numeroComprobante: 'REC-2026-111111',
        infracciones: [actaPendiente1Id],
        montoTotalAbonado: 15000,
        medioPago: 'contado',
        pagador: { nombreCompleto: 'Comprador Activo', dniCuit: '33444555' },
        cajero: auth.administrativoId,
        estado: 'completado',
      });
      comprobanteValido = pagoActivo.numeroComprobante;
      pagoValidoId = pagoActivo._id.toString();

      await PagoModel.create({
        numeroComprobante: 'REC-2026-000000',
        infracciones: [actaPendiente2Id],
        montoTotalAbonado: 25000,
        medioPago: 'contado',
        pagador: { nombreCompleto: 'Comprador Anulado', dniCuit: '99888777' },
        cajero: auth.administrativoId,
        estado: 'anulado',
        motivoAnulacion: 'Error de tipeo',
      });
    });

    it('GET /pagos debe listar exclusivamente pagos completados y permitir filtrar por medioPago (200)', async () => {
      const res = await request(app)
        .get('/pagos?medioPago=contado')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].numeroComprobante).toBe('REC-2026-111111');
      expect(res.body[0].estado).toBe('completado');
    });

    it('GET /pagos/:id debe obtener el comprobante por su número correlativo REC- (200)', async () => {
      const res = await request(app)
        .get(`/pagos/${comprobanteValido}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.numeroComprobante).toBe(comprobanteValido);
      expect(res.body.pagador.dniCuit).toBe('33444555');
    });

    it('GET /pagos/:id debe obtener el comprobante por su ObjectId (200)', async () => {
      const res = await request(app)
        .get(`/pagos/${pagoValidoId}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(pagoValidoId);
    });

    it('GET /pagos/:id debe responder 404 si el comprobante no existe', async () => {
      const res = await request(app)
        .get('/pagos/REC-9999-999999')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });
  });

  // -------------------------------------------------------------
  // 3. ANULACIÓN DE PAGOS (PUT /pagos/:id/anular)
  // -------------------------------------------------------------
  describe('PUT /pagos/:id/anular (anularPago)', () => {
    let pagoCompletadoId: string;

    beforeEach(async () => {
      // Registrar un pago válido para poder anularlo
      const cobro = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [actaPendiente1Id],
          medioPago: 'contado',
          pagador: { nombreCompleto: 'Titular Anulacion', dniCuit: '20111222' },
        });

      pagoCompletadoId = cobro.body.pago._id;
    });

    it('debe responder 403 Forbidden si un administrativo intenta anular un pago', async () => {
      const res = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivo: 'Intento de anulación por administrativo' });

      expect(res.status).toBe(403);
    });

    it('debe responder 400 si no se envía motivo de anulación', async () => {
      const res = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('motivo');
    });

    it('un admin debe poder anular un pago y revertir automáticamente las actas al estado pendiente (200)', async () => {
      const res = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Operación declinada por el banco emisor' });

      expect(res.status).toBe(200);
      expect(res.body.pago.estado).toBe('anulado');
      expect(res.body.pago.motivoAnulacion).toBe('Operación declinada por el banco emisor');

      // Comprobar reversión de estado en la infracción
      const actaRevertida = await InfraccionModel.findById(actaPendiente1Id);
      expect(actaRevertida?.estado).toBe('pendiente');
    });

    it('debe responder 400 si se intenta anular un pago que ya se encuentra anulado', async () => {
      // Primera anulación válida
      await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Primera anulación' });

      // Segundo intento sobre el mismo pago
      const res = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Segundo intento' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ya se encuentra anulado');
    });

    it('debe responder 404 si el ID del pago a anular no existe en la base de datos', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/pagos/${nonExistentId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'ID no existente' });

      expect(res.status).toBe(404);
    });
  });
});