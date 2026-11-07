// test/panel.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { TitularModel } from '../src/models/Titular';
import { VehiculoModel } from '../src/models/Vehiculo';
import { InfraccionModel } from '../src/models/Infraccion';
import { PagoModel } from '../src/models/Pago';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Panel de Control y Reportes - Tests de Integración', () => {
  let auth: TestAuthContext;
  let titularId: string;
  let vehiculoPatente: string;

  beforeEach(async () => {
    auth = await setupTestAuth();

    await PagoModel.deleteMany({});
    await InfraccionModel.deleteMany({});
    await VehiculoModel.deleteMany({});
    await TitularModel.deleteMany({});

    // 1. Titular
    const titular = await TitularModel.create({
      nombre: 'Martin',
      apellido: 'Palermo',
      dni: '23999888',
      domicilio: 'Brandsen 805',
      email: 'martin@test.com',
    });
    titularId = titular._id.toString();

    // 2. Vehículo
    vehiculoPatente = 'AB999CD';
    const vehiculo = await VehiculoModel.create({
      patente: vehiculoPatente,
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: 2023,
      titulares: [{ titular: titular._id, porcentajeTitularidad: 100 }],
    });

    // 3. Actas en diferentes estados
    const acta1 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-P1',
      codigoBarras: '044001',
      vehiculo: vehiculo._id,
      tipoFalta: 'Exceso de velocidad',
      lugar: 'Av. Libertador 2000',
      monto: 50000,
      estado: 'pendiente',
      inspector: auth.inspectorId,
    });

    const acta2 = await InfraccionModel.create({
      numeroActa: 'ACTA-2026-P2',
      codigoBarras: '044002',
      vehiculo: vehiculo._id,
      tipoFalta: 'Semáforo en rojo',
      lugar: 'Av. Corrientes 1500',
      monto: 30000,
      estado: 'pagada',
      inspector: auth.inspectorId,
    });

    await InfraccionModel.create({
      numeroActa: 'ACTA-2026-P3',
      codigoBarras: '044003',
      vehiculo: vehiculo._id,
      tipoFalta: 'Estacionar en ochava',
      lugar: 'Av. Corrientes 1500',
      monto: 20000,
      estado: 'anulada',
      inspector: auth.inspectorId,
    });

    // 4. Pago completado
    await PagoModel.create({
      numeroComprobante: 'REC-2026-00099',
      infracciones: [acta2._id],
      montoTotalAbonado: 30000,
      medioPago: 'tarjeta',
      pagador: { nombreCompleto: 'Martin Palermo', dniCuit: '23999888' },
      cajero: auth.administrativoId,
      estado: 'completado',
    });
  });

  it('debe calcular la deuda exigible por patente sumando solo pendientes y no las pagadas ni anuladas (200)', async () => {
    const res = await request(app)
      .get(`/panel/deuda/patente/${vehiculoPatente}`)
      .set('Authorization', `Bearer ${auth.administrativoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.vehiculo.patente).toBe(vehiculoPatente);
    expect(res.body.deudaTotal).toBe(50000);
    expect(res.body.cantidadActasImpagas).toBe(1);
  });

  it('debe calcular la deuda acumulada de un titular a través de sus vehículos (200)', async () => {
    const res = await request(app)
      .get(`/panel/deuda/titular/${titularId}`)
      .set('Authorization', `Bearer ${auth.administrativoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deudaTotal).toBe(50000);
    expect(res.body.cantidadActasImpagas).toBe(1);
  });

  it('debe devolver métricas del período con agrupación de estados, recaudación y top de faltas (200)', async () => {
    const res = await request(app)
      .get('/panel/metricas')
      .set('Authorization', `Bearer ${auth.administrativoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.actasPorEstado).toBeDefined();
    expect(res.body.recaudacion.totalRecaudado).toBe(30000);
    expect(res.body.estadisticas.topFaltas.length).toBeGreaterThan(0);
    expect(res.body.estadisticas.zonasCriticas.length).toBeGreaterThan(0);
  });

  it('debe responder 403 si un inspector intenta acceder a los balances del panel', async () => {
    const res = await request(app)
      .get('/panel/metricas')
      .set('Authorization', `Bearer ${auth.inspectorToken}`);

    expect(res.status).toBe(403);
  });
});