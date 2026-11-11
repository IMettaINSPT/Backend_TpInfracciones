// test/pago.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import app from '../src/app';
import { PagoModel } from '../src/models/Pago';
import { InfraccionModel } from '../src/models/Infraccion';
import { VehiculoModel } from '../src/models/Vehiculo';
import { TitularModel } from '../src/models/Titular';
import { UserModel } from '../src/models/User';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Módulo de Pagos - Tests de Integración y Cobertura Completa', () => {
  let auth: TestAuthContext;
  let acta1Id: string;
  let acta2Id: string;
  let actaPagadaId: string;

  beforeEach(async () => {
    //genero usuarios de prueba
    auth = await setupTestAuth();

    await PagoModel.deleteMany({});
    await InfraccionModel.deleteMany({});
    await VehiculoModel.deleteMany({});
    await TitularModel.deleteMany({});

    // 1. Titular y Vehículo 
    const titular = await TitularModel.create({
      esPersonaJuridica: false,
      nombre: 'ivan',
      apellido: 'Pérez',
      dni: '30111222',
      domicilio: 'Av. Corrientes 1234',
      email: 'ivan.perez@test.com',
    });

    const vehiculo = await VehiculoModel.create({
      patente: 'AA123BB',
      marca: 'Fiat',
      modelo: 'Cronos',
      anio: 2023,
      titulares: [
        {
          titular: titular._id,
          porcentajeTitularidad: 100,
          fechaAltaRegistro: new Date(),
        },
      ],
    });

    // 2. Infracciones de prueba
    const acta1 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-0001',
      codigoBarras: '0442026000115000',
      vehiculo: vehiculo._id,
      tipoFalta: 'Exceso de velocidad',
      lugar: 'Av. Libertador 4500',
      monto: 15000,
      estado: 'pendiente',
      inspector: new Types.ObjectId(auth.inspectorId),
    });
    acta1Id = acta1._id.toString();

    const acta2 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-0002',
      codigoBarras: '0442026000225000',
      vehiculo: vehiculo._id,
      tipoFalta: 'Semáforo en rojo',
      lugar: 'Av. 9 de Julio 500',
      monto: 25000,
      estado: 'pendiente',
      inspector: new Types.ObjectId(auth.inspectorId),
    });
    acta2Id = acta2._id.toString();

    const actaPagada = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-0003',
      codigoBarras: '0442026000310000',
      vehiculo: vehiculo._id,
      tipoFalta: 'Estacionar en ochava',
      lugar: 'San Martín 100',
      monto: 10000,
      estado: 'pagada',
      inspector: new Types.ObjectId(auth.inspectorId),
    });
    actaPagadaId = actaPagada._id.toString();
  });

  // =========================================================================
  // 1. REGISTRO DE COBROS ONLINE (POST /pagos)
  // =========================================================================
  describe('POST /pagos (registrarPago)', () => {
    it('debe registrar un cobro con tarjeta de crédito/débito guardando solo los últimos 4 dígitos (201)', async () => {
      const payload = {
        infraccionesIds: [acta1Id],
        medioPago: 'tarjeta',
        datosTarjeta: {
          tipoTarjeta: 'debito',
          emisor: 'visa',
          nombreTitular: 'CARLOS PEREZ',
          numeroTarjeta: '4500123456784321',
          mesExpiracion: '05',
          anioExpiracion: '2028',
        },
        pagador: {
          nombreCompleto: 'Carlos Pérez',
          dniCuit: '30111222',
          email: 'carlos@test.com',
        },
      };

      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.pago).toBeDefined();
      expect(res.body.pago.medioPago).toBe('tarjeta');
      expect(res.body.pago.datosTarjeta.ultimos4Digitos).toBe('4321');
      expect(res.body.pago.datosTarjeta.codigoAutorizacion).toBeDefined();
      expect(res.body.pago.datosTarjeta.numeroTarjeta).toBeUndefined();

      // Verificar que el acta pasó a estado 'pagada'
      const acta = await InfraccionModel.findById(acta1Id);
      expect(acta?.estado).toBe('pagada');
    });

    it('debe registrar un cobro con billetera virtual de múltiples actas (201)', async () => {
      const payload = {
        infraccionesIds: [acta1Id, acta2Id],
        medioPago: 'billetera_virtual',
        datosBilletera: {
          proveedor: 'mercadopago',
          idTransaccionExterna: 'MP-9988776655',
          tipoPago: 'account_money',
          montoNetoRecibido: 38000,
          comisionPasarela: 2000,
          emailPagadorPasarela: 'carlos.mp@test.com',
        },
        pagador: {
          nombreCompleto: 'Carlos Pérez',
          dniCuit: '30111222',
        },
      };

      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.pago.numeroComprobante).toMatch(/^REC-/);
      expect(res.body.pago.montoTotalAbonado).toBe(40000);
      expect(res.body.pago.datosBilletera.proveedor).toBe('mercadopago');
      expect(res.body.pago.datosBilletera.idTransaccionExterna).toBe('MP-9988776655');
      expect(res.body.cantidadActas).toBe(2);

      // Ambas actas deben estar pagadas
      const actas = await InfraccionModel.find({ _id: { $in: [acta1Id, acta2Id] } });
      expect(actas.every((a) => a.estado === 'pagada')).toBe(true);
    });

    it('debe responder 403 Forbidden si un inspector intenta procesar un pago', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({
          infraccionesIds: [acta1Id],
          medioPago: 'tarjeta',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(403);
    });

    it('debe responder 400 si el array de actas está vacío o no es un array', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [],
          medioPago: 'tarjeta',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('al menos una infracción');
    });

    it('debe responder 400 si se envía un ID de infracción con formato no válido de ObjectId', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: ['id-invalido-123'],
          medioPago: 'tarjeta',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('inválidos');
    });

    it('debe responder 404 si una de las actas no existe en la base de datos', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [acta1Id, fakeId],
          medioPago: 'tarjeta',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no fueron encontradas');
    });

    it('debe responder 400 si alguna de las actas ya se encuentra abonada', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [acta1Id, actaPagadaId],
          medioPago: 'tarjeta',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ya se encuentran abonadas o anuladas');
    });

    it('debe responder 400 si se envía contado u otro medio no soportado', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [acta1Id],
          medioPago: 'contado',
          pagador: { nombreCompleto: 'Test', dniCuit: '123' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Solo se admiten pagos online');
    });

    it('debe responder 400 si faltan datos del pagador o campos obligatorios de la tarjeta', async () => {
      // Falta pagador
      const resSinPagador = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [acta1Id],
          medioPago: 'tarjeta',
          pagador: { nombreCompleto: '', dniCuit: '' },
        });
      expect(resSinPagador.status).toBe(400);

      // Falta datosTarjeta
      const resSinTarjeta = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [acta1Id],
          medioPago: 'tarjeta',
          pagador: { nombreCompleto: 'Juan Test', dniCuit: '2030111222' },
          datosTarjeta: {},
        });
      expect(resSinTarjeta.status).toBe(400);
    });

    it('debe responder 400 si se selecciona billetera virtual pero falta proveedor o idTransaccion', async () => {
      const res = await request(app)
        .post('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          infraccionesIds: [acta1Id],
          medioPago: 'billetera_virtual',
          pagador: { nombreCompleto: 'Juan Test', dniCuit: '2030111222' },
          datosBilletera: { proveedor: '' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('proveedor e idTransaccionExterna');
    });
  });

  // =========================================================================
  // 2. CONSULTAS Y FILTROS AVANZADOS (GET /pagos y GET /pagos/:id)
  // =========================================================================
  describe('GET /pagos y GET /pagos/:id', () => {
    let pago1Id: string;
    let pagoComprobante: string;

    beforeEach(async () => {
      // Pago 1: tarjeta, completado
      const pago1 = await PagoModel.create({
        numeroComprobante: 'REC-2026-111111',
        infracciones: [new Types.ObjectId(acta1Id)],
        montoTotalAbonado: 15000,
        medioPago: 'tarjeta',
        datosTarjeta: {
          tipoTarjeta: 'credito',
          emisor: 'visa',
          nombreTitular: 'JUAN PEREZ',
          ultimos4Digitos: '4321',
          mesExpiracion: '11',
          anioExpiracion: '2027',
        },
        pagador: { nombreCompleto: 'Juan Perez', dniCuit: '20111222' },
        cajero: new Types.ObjectId(auth.administrativoId),
        fechaPago: new Date('2026-05-10T10:00:00.000Z'),
        estado: 'completado',
      });
      pago1Id = pago1._id.toString();
      pagoComprobante = pago1.numeroComprobante;

      // Pago 2: billetera_virtual, completado
      await PagoModel.create({
        numeroComprobante: 'REC-2026-222222',
        infracciones: [new Types.ObjectId(acta2Id)],
        montoTotalAbonado: 25000,
        medioPago: 'billetera_virtual',
        datosBilletera: {
          proveedor: 'mercadopago',
          idTransaccionExterna: 'MP-12345',
          estadoTransaccion: 'approved',
        },
        pagador: { nombreCompleto: 'Maria Gomez', dniCuit: '27333444' },
        cajero: new Types.ObjectId(auth.administrativoId),
        fechaPago: new Date('2026-06-15T15:30:00.000Z'),
        estado: 'completado',
      });

      // Pago 3: anulado (debe omitirse por defecto en el listado)
      await PagoModel.create({
        numeroComprobante: 'REC-2026-999999',
        infracciones: [new Types.ObjectId(actaPagadaId)],
        montoTotalAbonado: 10000,
        medioPago: 'tarjeta',
        pagador: { nombreCompleto: 'Anulado Test', dniCuit: '20999888' },
        cajero: new Types.ObjectId(auth.administrativoId),
        fechaPago: new Date('2026-06-20T10:00:00.000Z'),
        estado: 'anulado',
        motivoAnulacion: 'Error de cobro',
      });
    });

    it('GET /pagos debe listar únicamente pagos completados excluyendo los anulados (200)', async () => {
      const res = await request(app)
        .get('/pagos')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body.every((p: any) => p.estado !== 'anulado')).toBe(true);
    });

    it('GET /pagos debe permitir filtrar por medioPago y por número de comprobante parcial (200)', async () => {
      // Filtro medioPago
      const resMedio = await request(app)
        .get('/pagos?medioPago=billetera_virtual')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(resMedio.status).toBe(200);
      expect(resMedio.body.length).toBe(1);
      expect(resMedio.body[0].numeroComprobante).toBe('REC-2026-222222');

      // Filtro comprobante
      const resComp = await request(app)
        .get('/pagos?comprobante=111111')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(resComp.status).toBe(200);
      expect(resComp.body.length).toBe(1);
      expect(resComp.body[0].numeroComprobante).toBe('REC-2026-111111');
    });

    it('GET /pagos debe permitir filtrar por rango de fechas (200)', async () => {
      const res = await request(app)
        .get('/pagos?fechaDesde=2026-06-01&fechaHasta=2026-06-30')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].numeroComprobante).toBe('REC-2026-222222');
    });

    it('GET /pagos debe filtrar por nombre del cajero (auditoría cruzada con User)', async () => {
      // Buscar con nombre existente (creado por auth.helper)
      const resOk = await request(app)
        .get('/pagos?cajeroNombre=Administrativo')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(resOk.status).toBe(200);
      expect(Array.isArray(resOk.body)).toBe(true);

      // Buscar cajero inexistente debe devolver array vacío []
      const resVacio = await request(app)
        .get('/pagos?cajeroNombre=NombreInexistenteXYZ')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(resVacio.status).toBe(200);
      expect(resVacio.body).toEqual([]);
    });

    it('GET /pagos/:id debe obtener el detalle por ObjectId con sus relaciones populadas (200)', async () => {
      const res = await request(app)
        .get(`/pagos/${pago1Id}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(pago1Id);
      expect(res.body.numeroComprobante).toBe(pagoComprobante);
      expect(res.body.cajero).toHaveProperty('nombre');
      expect(res.body.infracciones[0]).toHaveProperty('numeroActa');
    });

    it('GET /pagos/:id debe responder 400 si el ID no es un ObjectId válido', async () => {
      const res = await request(app)
        .get('/pagos/id-invalido-123')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ID de pago inválido');
    });

    it('GET /pagos/:id debe responder 404 si el ObjectId no existe', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/pagos/${idInexistente}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });
  });

  // =========================================================================
  // 3. ANULACIÓN DE COBRO Y REVERSIÓN DE ACTAS (PUT /pagos/:id/anular)
  // =========================================================================
  describe('PUT /pagos/:id/anular (cancelPayment)', () => {
    let pagoCompletadoId: string;

    beforeEach(async () => {
      // Dejamos el acta 1 marcada como pagada
      await InfraccionModel.findByIdAndUpdate(acta1Id, { estado: 'pagada' });

      const pago = await PagoModel.create({
        numeroComprobante: 'REC-2026-777888',
        infracciones: [new Types.ObjectId(acta1Id)],
        montoTotalAbonado: 15000,
        medioPago: 'tarjeta',
        pagador: { nombreCompleto: 'Titular Anulable', dniCuit: '20111222' },
        cajero: new Types.ObjectId(auth.administrativoId),
        estado: 'completado',
      });

      pagoCompletadoId = pago._id.toString();
    });

    it('debe responder 403 Forbidden si un administrativo intenta anular un cobro', async () => {
      const res = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivo: 'Intento administrativo no autorizado' });

      expect(res.status).toBe(403);
    });

    it('debe responder 400 si el ID es inválido o si no se envía motivo de anulación', async () => {
      // ID inválido
      const resIdInvalido = await request(app)
        .put('/pagos/id-no-valido/anular')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Error' });
      expect(resIdInvalido.status).toBe(400);

      // Sin motivo
      const resSinMotivo = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: '   ' });
      expect(resSinMotivo.status).toBe(400);
      expect(resSinMotivo.body.error).toContain('motivo');
    });

    it('un admin debe anular el pago y revertir automáticamente las actas a "pendiente" (200)', async () => {
      const res = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Contracargo reportado por la pasarela de pagos' });

      expect(res.status).toBe(200);
      expect(res.body.pago.estado).toBe('anulado');
      expect(res.body.pago.motivoAnulacion).toBe('Contracargo reportado por la pasarela de pagos');

      // Las actas asociadas deben quedar restituidas en estado 'pendiente'
      const actaRevertida = await InfraccionModel.findById(acta1Id);
      expect(actaRevertida?.estado).toBe('pendiente');
    });

    it('debe responder 400 si se intenta anular un pago que ya se encontraba anulado', async () => {
      // Primera anulación legítima
      await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Anulación inicial' });

      // Segundo intento sobre el mismo registro
      const res = await request(app)
        .put(`/pagos/${pagoCompletadoId}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Reintento redundante' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ya se encuentra anulado');
    });

    it('debe responder 404 si el ID del pago a anular no existe en la base de datos', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/pagos/${idInexistente}/anular`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ motivo: 'Inexistente' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });
  });
});