// test/titular.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { TitularModel } from '../src/models/Titular';
import { VehiculoModel } from '../src/models/Vehiculo';
import { setupTestAuth, TestAuthContext } from './helpers/auth.helper';

describe('Entidad Titular - Tests de Integración', () => {
  let auth: TestAuthContext;

  //centralizo la creación de tokens y usuarios de prueba para los distintos roles, para no repetir código en cada test
  beforeEach(async () => {
    auth = await setupTestAuth();
  });

  // ALTA DE TITULARES
  describe('POST /titulares', () => {
    it('debe registrar un titular persona física con éxito (201)', async () => {
      const payload = {
        esPersonaJuridica: false,
        nombre: 'Carlos',
        apellido: 'Rodríguez',
        dni: '32111222',
        domicilio: 'Calle San Martín 450',
        email: 'carlos.rodriguez@email.com',
        telefono: '1123456789',
      };

      const res = await request(app)
        .post('/titulares')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.titular).toMatchObject({
        nombre: 'Carlos',
        apellido: 'Rodríguez',
        dni: '32111222',
        esPersonaJuridica: false,
      });
    });

    it('debe registrar un titular persona jurídica requiriendo CUIT (201)', async () => {
      const payload = {
        esPersonaJuridica: true,
        nombre: 'Logística Sur S.A.',
        cuit: '30-71234567-9',
        domicilio: 'Parque Industrial Lote 12',
        email: 'contacto@logisticasur.com',
      };

      const res = await request(app)
        .post('/titulares')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.titular.cuit).toBe('30-71234567-9');
      expect(res.body.titular.esPersonaJuridica).toBe(true);
    });

    it('debe responder 400 si falta el DNI o el apellido en persona física', async () => {
      const res = await request(app)
        .post('/titulares')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          esPersonaJuridica: false,
          nombre: 'Juan',
          domicilio: 'Av. Corrientes 100',
          email: 'sinapellido@mail.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('DNI y apellido son obligatorios');
    });

    it('debe responder 400 si falta el CUIT en persona jurídica', async () => {
      const res = await request(app)
        .post('/titulares')
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          esPersonaJuridica: true,
          nombre: 'Empresa Sin CUIT S.R.L.',
          domicilio: 'Av. Libertador 500',
          email: 'empresa@mail.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('El CUIT es obligatorio');
    });

    it('debe rechazar con 400 si el DNI ya se encuentra registrado', async () => {
      await TitularModel.create({
        nombre: 'Existente',
        apellido: 'Uno',
        dni: '35000111',
        domicilio: 'Calle 10',
        email: 'uno@mail.com',
      });

      const res = await request(app)
        .post('/titulares')
        .set('Authorization', `Bearer ${auth.adminToken}`)
        .send({
          esPersonaJuridica: false,
          nombre: 'Repetido',
          apellido: 'Dos',
          dni: '35000111',
          domicilio: 'Calle 20',
          email: 'dos@mail.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ya existe un titular registrado con ese DNI');
    });

    it('debe responder 403 Forbidden si un inspector intenta dar de alta un titular', async () => {
      const res = await request(app)
        .post('/titulares')
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({
          nombre: 'Intento',
          apellido: 'Fallido',
          dni: '40111222',
          domicilio: 'Calle 1',
          email: 'fallido@mail.com',
        });

      expect(res.status).toBe(403);
    });
  });

  // CONSULTAS DE TITULARES
  describe('GET /titulares y GET /titulares/:id (Restricciones para Inspector)', () => {
    it('debe permitir a un administrativo listar y filtrar titulares (200)', async () => {
      await TitularModel.create({
        nombre: 'Mariana',
        apellido: 'López',
        dni: '29888777',
        domicilio: 'Belgrano 100',
        email: 'mariana@mail.com',
      });

      const res = await request(app)
        .get('/titulares?busqueda=29888777')
        .set('Authorization', `Bearer ${auth.administrativoToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].apellido).toBe('López');
    });

    it('debe responder 403 Forbidden si un inspector intenta listar titulares directamente', async () => {
      const res = await request(app)
        .get('/titulares')
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(403);
    });

    it('debe responder 403 Forbidden si un inspector intenta consultar un titular por ID', async () => {
      const titular = await TitularModel.create({
        nombre: 'Pedro',
        apellido: 'Gómez',
        dni: '28000111',
        domicilio: 'Alsina 50',
        email: 'pedro@mail.com',
      });

      const res = await request(app)
        .get(`/titulares/${titular._id}`)
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(403);
    });

    it('debe responder 404 al consultar un ID inexistente con credenciales administrativas', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/titulares/${idInexistente}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Titular no encontrado');
    });
  });

  // ACTUALIZACIÓN DE DATOS
  describe('PUT /titulares/:id', () => {
    it('debe permitir a un administrativo actualizar datos de contacto (200)', async () => {
      const titular = await TitularModel.create({
        nombre: 'Martín',
        apellido: 'Fierro',
        dni: '18000111',
        domicilio: 'Pampa 10',
        email: 'martin@campo.com',
      });

      const res = await request(app)
        .put(`/titulares/${titular._id}`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({
          domicilio: 'Av. Corrientes 2000',
          telefono: '1199998888',
        });

      expect(res.status).toBe(200);
      expect(res.body.titular.domicilio).toBe('Av. Corrientes 2000');
      expect(res.body.titular.telefono).toBe('1199998888');
    });

    it('debe responder 403 si un inspector intenta actualizar datos de un titular', async () => {
      const titular = await TitularModel.create({
        nombre: 'Clara',
        apellido: 'Ríos',
        dni: '39000111',
        domicilio: 'Calle 5',
        email: 'clara@mail.com',
      });

      const res = await request(app)
        .put(`/titulares/${titular._id}`)
        .set('Authorization', `Bearer ${auth.inspectorToken}`)
        .send({ domicilio: 'Calle Nueva 123' });

      expect(res.status).toBe(403);
    });
  });

  // ELIMINACIÓN DE TITULAR
  describe('DELETE /titulares/:id', () => {
    it('debe rechazar la eliminación si el titular tiene vehículos vigentes asociados (400)', async () => {
      const titular = await TitularModel.create({
        nombre: 'Dueño',
        apellido: 'Con Coche',
        dni: '33222111',
        domicilio: 'Mitre 200',
        email: 'coche@mail.com',
      });

      await VehiculoModel.create({
        patente: 'AA111BB',
        marca: 'Ford',
        modelo: 'Focus',
        anio: 2020,
        titulares: [{ titular: titular._id, porcentajeTitularidad: 100, fechaAltaRegistro: new Date() }],
      });

      const res = await request(app)
        .delete(`/titulares/${titular._id}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('vehículos activos vinculados');
    });

    it('debe eliminar exitosamente a un titular sin vehículos vigentes (200)', async () => {
      const titularLibre = await TitularModel.create({
        nombre: 'Sin',
        apellido: 'Autos',
        dni: '38111999',
        domicilio: 'Alberdi 55',
        email: 'libre@mail.com',
      });

      const res = await request(app)
        .delete(`/titulares/${titularLibre._id}`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Titular eliminado exitosamente');

      const buscado = await TitularModel.findById(titularLibre._id);
      expect(buscado).toBeNull();
    });

    it('debe responder 403 si un inspector intenta eliminar un titular', async () => {
      const titular = await TitularModel.create({
        nombre: 'Prueba',
        apellido: 'Borrado',
        dni: '37111222',
        domicilio: 'Calle 8',
        email: 'borrado@mail.com',
      });

      const res = await request(app)
        .delete(`/titulares/${titular._id}`)
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(403);
    });
  });

  // BAJA DE TITULARIDAD
  describe('PATCH /titulares/:id/vehiculos/:vehiculoId/baja', () => {
    it('debe asentar fecha de baja de titularidad sobre un vehículo (200)', async () => {
      const titular = await TitularModel.create({
        nombre: 'Rubén',
        apellido: 'Díaz',
        dni: '22333444',
        domicilio: 'Calle Falsa 123',
        email: 'ruben@mail.com',
      });

      const vehiculo = await VehiculoModel.create({
        patente: 'AA123BB',
        marca: 'Fiat',
        modelo: 'Palio',
        anio: 2017,
        titulares: [
          {
            titular: titular._id,
            porcentajeTitularidad: 100,
            fechaAltaRegistro: new Date(),
          },
        ],
      });

      const res = await request(app)
        .patch(`/titulares/${titular._id}/vehiculos/${vehiculo._id}/baja`)
        .set('Authorization', `Bearer ${auth.administrativoToken}`)
        .send({ motivo: 'Venta del rodado y transferencia' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Baja de titularidad procesada exitosamente');
      expect(res.body).toHaveProperty('fechaBajaRegistro');

      const vehiculoDb = await VehiculoModel.findById(vehiculo._id);
      const regTitularidad = vehiculoDb?.titulares.find(
        (t: any) => t.titular.toString() === titular._id.toString()
      );
      expect(regTitularidad?.fechaBajaRegistro).toBeDefined();
    });

    it('debe responder 400 si el titular no figura como titular vigente del rodado', async () => {
      const titular = await TitularModel.create({
        nombre: 'Lucía',
        apellido: 'Paz',
        dni: '30111444',
        domicilio: 'Av. Libertador 100',
        email: 'lucia@mail.com',
      });

      const vehiculo = await VehiculoModel.create({
        patente: 'AD444EE',
        marca: 'Volkswagen',
        modelo: 'Suran',
        anio: 2019,
        titulares: [],
      });

      const res = await request(app)
        .patch(`/titulares/${titular._id}/vehiculos/${vehiculo._id}/baja`)
        .set('Authorization', `Bearer ${auth.adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no figura como titular vigente');
    });

    it('debe responder 403 si un inspector intenta dar de baja la titularidad', async () => {
      const idFicticio1 = new mongoose.Types.ObjectId().toString();
      const idFicticio2 = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/titulares/${idFicticio1}/vehiculos/${idFicticio2}/baja`)
        .set('Authorization', `Bearer ${auth.inspectorToken}`);

      expect(res.status).toBe(403);
    });
  });
});