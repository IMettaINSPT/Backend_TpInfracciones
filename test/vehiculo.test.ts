// test/vehiculo.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { VehiculoModel } from '../src/models/Vehiculo';
import { TitularModel } from '../src/models/Titular';
import { InfraccionModel } from '../src/models/Infraccion';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Entidad Vehiculo - Tests de Integración', () => {
  let auth: TestAuthContext;

  beforeEach(async () => {
    auth = await setupTestAuth();
  });

  describe('POST /vehiculos (createVehiculo)', () => {
    it('debe registrar un vehículo correctamente y normalizar la patente en mayúsculas (201)', async () => {
      const titular = await TitularModel.create({
        nombre: 'Esteban',
        apellido: 'Quito',
        dni: '27654321',
        domicilio: 'Lavalle 1020',
        email: 'esteban@mail.com',
      });

      const payload = {
        patente: 'af123jk',
        marca: 'Toyota',
        modelo: 'Corolla',
        anio: 2023,
        titulares: [{ titular: titular._id.toString(), porcentajeTitularidad: 100 }],
      };

      const res = await request(app)
        .post('/vehiculos')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.vehiculo.patente).toBe('AF123JK');
      expect(res.body.vehiculo.titulares).toHaveLength(1);
    });

    it('debe rechazar con 400 si la patente ya existe', async () => {
      await VehiculoModel.create({
        patente: 'AE999ZZ',
        marca: 'Fiat',
        modelo: 'Cronos',
        anio: 2022,
      });

      const res = await request(app)
        .post('/vehiculos')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          patente: 'ae999zz',
          marca: 'Fiat',
          modelo: 'Cronos',
          anio: 2022,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ya existe un vehículo registrado con esa patente');
    });

    it('debe rechazar con 400 si faltan campos obligatorios', async () => {
      const res = await request(app)
        .post('/vehiculos')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          patente: 'AD555AA',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Patente, marca, modelo y año son obligatorios');
    });

    it('debe responder 403 si un inspector intenta registrar un vehículo', async () => {
      const res = await request(app)
        .post('/vehiculos')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({
          patente: 'AB123CD',
          marca: 'Chevrolet',
          modelo: 'Cruze',
          anio: 2021,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /vehiculos/patente/:patente (getVehiculoByPatente)', () => {
    it('un inspector debe poder consultar un vehículo por patente y recibir sus titulares vigentes (200)', async () => {
      const titular = await TitularModel.create({
        nombre: 'Sofía',
        apellido: 'García',
        dni: '36000222',
        domicilio: 'San Martín 150',
        email: 'sofia@mail.com',
      });

      await VehiculoModel.create({
        patente: 'AC333DD',
        marca: 'Peugeot',
        modelo: '208',
        anio: 2021,
        titulares: [{ titular: titular._id, porcentajeTitularidad: 100 }],
      });

      const res = await request(app)
        .get('/vehiculos/patente/AC333DD')
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.patente).toBe('AC333DD');
      expect(res.body.titularesVigentes).toBeDefined();
      expect(res.body.titularesVigentes).toHaveLength(1);
      expect(res.body.titularesVigentes[0].titular).toMatchObject({
        nombre: 'Sofía',
        apellido: 'García',
        dni: '36000222',
      });
    });

    it('debe responder 404 si la patente buscada no existe', async () => {
      const res = await request(app)
        .get('/vehiculos/patente/ZZ999ZZ')
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vehículo no encontrado para la patente especificada');
    });
  });

  describe('POST /vehiculos/:id/titulares (addTitularVehiculo)', () => {
    it('debe permitir asignar un nuevo titular al vehículo (200)', async () => {
      const vehiculo = await VehiculoModel.create({
        patente: 'AB444CD',
        marca: 'Renault',
        modelo: 'Kangoo',
        anio: 2019,
      });

      const nuevoTitular = await TitularModel.create({
        nombre: 'Hernán',
        apellido: 'Cortés',
        dni: '24111333',
        domicilio: 'Rivadavia 400',
        email: 'hernan@mail.com',
      });

      const res = await request(app)
        .post(`/vehiculos/${vehiculo._id}/titulares`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          titularId: nuevoTitular._id.toString(),
          porcentajeTitularidad: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Titular asignado exitosamente');

      const vehiculoDb = await VehiculoModel.findById(vehiculo._id);
      expect(vehiculoDb?.titulares).toHaveLength(1);
    });

    it('debe responder 400 si el titular ya se encuentra activo en el vehículo', async () => {
      const titular = await TitularModel.create({
        nombre: 'Laura',
        apellido: 'Méndez',
        dni: '31222444',
        domicilio: 'Alsina 80',
        email: 'laura@mail.com',
      });

      const vehiculo = await VehiculoModel.create({
        patente: 'AA777BB',
        marca: 'Volkswagen',
        modelo: 'Gol',
        anio: 2018,
        titulares: [{ titular: titular._id, porcentajeTitularidad: 100 }],
      });

      const res = await request(app)
        .post(`/vehiculos/${vehiculo._id}/titulares`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({ titularId: titular._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ya se encuentra asignado y vigente');
    });
  });

  describe('DELETE /vehiculos/:id (deleteVehiculo)', () => {
    it('debe rechazar la eliminación si el vehículo tiene actas labradas (400)', async () => {
      const vehiculo = await VehiculoModel.create({
        patente: 'AF888KK',
        marca: 'Ford',
        modelo: 'Ranger',
        anio: 2024,
      });

      await InfraccionModel.create({
        numeroActa: 'ACTA-DEL-2026-01',
        codigoBarras: '0442026000000000000085000',
        vehiculo: vehiculo._id,
        tipoFalta: 'Exceso de Velocidad',
        lugar: 'Av. Libertador 2400',
        fechaHora: new Date(),
        monto: 85000,
        estado: 'pendiente',
        inspector: auth.inspectorId,
      });

      const res = await request(app)
        .delete(`/vehiculos/${vehiculo._id}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('posee actas de infracción asociadas');
    });

    it('debe permitir eliminar un vehículo sin infracciones registradas (200)', async () => {
      const vehiculoLimpio = await VehiculoModel.create({
        patente: 'AG111ZZ',
        marca: 'Honda',
        modelo: 'Civic',
        anio: 2025,
      });

      const res = await request(app)
        .delete(`/vehiculos/${vehiculoLimpio._id}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Vehículo eliminado exitosamente');

      const borrado = await VehiculoModel.findById(vehiculoLimpio._id);
      expect(borrado).toBeNull();
    });
  });

  describe('Consultas generales y Actualización de Vehículos', () => {
    it('GET /vehiculos debe permitir listar vehículos y filtrar por marca o búsqueda', async () => {
      const res = await request(app)
        .get('/vehiculos?marca=Toyota&busqueda=Corolla')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /vehiculos/:id debe devolver el vehículo o 404 si no existe', async () => {
      const vehiculo = await VehiculoModel.create({
        patente: 'AA111BB',
        marca: 'Fiat',
        modelo: 'Palio',
        anio: 2015,
      });

      const res = await request(app)
        .get(`/vehiculos/${vehiculo._id}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.patente).toBe('AA111BB');

      const resNotFound = await request(app)
        .get('/vehiculos/6aee23cefce8fbbf4e7fe399')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);
      expect(resNotFound.status).toBe(404);
    });

    it('PUT /vehiculos/:id debe permitir actualizar los datos del vehículo (200)', async () => {
      const vehiculo = await VehiculoModel.create({
        patente: 'BB222CC',
        marca: 'Chevrolet',
        modelo: 'Onix',
        anio: 2019,
      });

      const res = await request(app)
        .put(`/vehiculos/${vehiculo._id}`)
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          marca: 'Chevrolet',
          modelo: 'Onix Plus',
          anio: 2020,
        });

      expect(res.status).toBe(200);
      expect(res.body.vehiculo.modelo).toBe('Onix Plus');
    });
  });
});