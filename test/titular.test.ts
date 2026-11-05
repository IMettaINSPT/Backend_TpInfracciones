// test/titular.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { UserModel } from '../src/models/User';
import { TitularModel } from '../src/models/Titular';
import { AuditLogModel } from '../src/models/AuditLog';
import bcrypt from 'bcrypt';

describe('Gestión de Titulares y Auditoría', () => {
  let token: string;
  const idInexistente = '662000000000000000000587';

  beforeEach(async () => {
    await UserModel.deleteMany({});
    await TitularModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    await UserModel.create({
      email: 'admin@infracciones.gob.ar',
      password: hashedPassword,
      role: 'administrativo',
      nombre: 'Administrador Auditor',
    });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@infracciones.gob.ar', password: 'Admin123!' });

    token = loginRes.body.token;
  });

  // --- CREACIÓN (POST /titulares) ---
  it('POST /titulares crea un titular y genera el registro en AuditLog', async () => {
    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        esPersonaJuridica: false,
        nombre: 'Carlos',
        domicilio: 'Av. Corrientes 1234',
        email: 'carlos@mail.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.titular).toHaveProperty('nombre', 'Carlos');

    const log = await AuditLogModel.findOne({ entidad: 'Titular', accion: 'CREACION' });
    expect(log).not.toBeNull();
    expect(log?.detalles?.datosNuevos).toHaveProperty('nombre', 'Carlos');
  });

  it('POST /titulares crea una persona jurídica con razón social', async () => {
    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        esPersonaJuridica: true,
        nombre: 'Transportes Norte S.A.',
        domicilio: 'Ruta 9 Km 20',
        email: 'contacto@norte.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.titular).toHaveProperty('esPersonaJuridica', true);
  });

  it('POST /titulares rechaza cuando falta el nombre en persona física con 400', async () => {
    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        esPersonaJuridica: false,
        domicilio: 'Av. Libertador 500',
        email: 'test@mail.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El nombre es obligatorio');
  });

  it('POST /titulares rechaza cuando falta la razón social en persona jurídica con 400', async () => {
    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        esPersonaJuridica: true,
        domicilio: 'Av. Libertador 500',
        email: 'test@mail.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La razón social es obligatoria');
  });

  it('POST /titulares rechaza cuando falta el domicilio con 400', async () => {
    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Juan',
        email: 'juan@mail.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El domicilio es obligatorio');
  });

  it('POST /titulares rechaza cuando falta el email con 400', async () => {
    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Juan',
        domicilio: 'Calle 123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El email es obligatorio');
  });

  it('POST /titulares rechaza CUIT duplicado con 400', async () => {
    await TitularModel.create({
      nombre: 'Empresa A',
      domicilio: 'Av. 1',
      email: 'a@mail.com',
      cuit: '20-11111111-2',
    });

    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Empresa B',
        domicilio: 'Av. 2',
        email: 'b@mail.com',
        cuit: '20-11111111-2',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ya existe un titular registrado con ese CUIT');
  });

  it('POST /titulares rechaza DNI duplicado con 400', async () => {
    await TitularModel.create({
      nombre: 'Pedro',
      domicilio: 'Av. 1',
      email: 'pedro@mail.com',
      dni: '30444555',
    });

    const res = await request(app)
      .post('/titulares')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Otro Pedro',
        domicilio: 'Av. 2',
        email: 'otropedro@mail.com',
        dni: '30444555',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ya existe un titular registrado con ese DNI');
  });

  // --- LECTURA GENERAL (GET /titulares) ---
  it('GET /titulares devuelve la lista de titulares y audita la lectura', async () => {
    await TitularModel.create({
      nombre: 'Titular Registrado',
      domicilio: 'Calle 50',
      email: 'titular@mail.com',
    });

    const res = await request(app)
      .get('/titulares')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const log = await AuditLogModel.findOne({ entidad: 'Titular', accion: 'LECTURA' });
    expect(log).not.toBeNull();
  });

  // --- LECTURA INDIVIDUAL (GET /titulares/:id) ---
  it('GET /titulares/:id devuelve 404 si el ID no existe', async () => {
    const res = await request(app)
      .get(`/titulares/${idInexistente}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Titular no encontrado');
  });

  it('GET /titulares/:id devuelve el titular existente y audita la lectura', async () => {
    const titular = await TitularModel.create({
      nombre: 'Laura',
      domicilio: 'Av. Colon 100',
      email: 'laura@mail.com',
    });

    const res = await request(app)
      .get(`/titulares/${titular._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Laura');

    const log = await AuditLogModel.findOne({ entidad: 'Titular', entidadId: titular._id });
    expect(log).not.toBeNull();
    expect(log?.accion).toBe('LECTURA');
  });

  // --- ACTUALIZACIÓN (PUT /titulares/:id) ---
  it('PUT /titulares/:id devuelve 404 si no existe', async () => {
    const res = await request(app)
      .put(`/titulares/${idInexistente}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ domicilio: 'Nuevo domicilio' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Titular no encontrado');
  });

  it('PUT /titulares/:id actualiza datos y guarda snapshot previo y nuevo', async () => {
    const titular = await TitularModel.create({
      esPersonaJuridica: false,
      nombre: 'Lucía',
      domicilio: 'Calle Falsa 123',
      email: 'lucia@mail.com',
    });

    const res = await request(app)
      .put(`/titulares/${titular._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        domicilio: 'Nueva Direccion 456',
        motivo: 'Cambio de domicilio legal',
      });

    expect(res.status).toBe(200);

    const log = await AuditLogModel.findOne({ entidad: 'Titular', accion: 'MODIFICACION' });
    expect(log).not.toBeNull();
    expect(log?.detalles?.datosAnteriores).toHaveProperty('domicilio', 'Calle Falsa 123');
    expect(log?.detalles?.datosNuevos).toHaveProperty('domicilio', 'Nueva Direccion 456');
  });

  it('PUT /titulares/:id actualiza teléfono y dni', async () => {
    const titular = await TitularModel.create({
      nombre: 'Marcos',
      domicilio: 'Calle 10',
      email: 'marcos@mail.com',
    });

    const res = await request(app)
      .put(`/titulares/${titular._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        telefono: '1199887766',
        dni: '40123123',
      });

    expect(res.status).toBe(200);
    expect(res.body.titular.telefono).toBe('1199887766');
    expect(res.body.titular.dni).toBe('40123123');
  });

  // --- ELIMINACIÓN (DELETE /titulares/:id) ---
  it('DELETE /titulares/:id devuelve 404 si no existe', async () => {
    const res = await request(app)
      .delete(`/titulares/${idInexistente}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Titular no encontrado');
  });

  it('DELETE /titulares/:id elimina el titular y genera log de ELIMINACION', async () => {
    const titular = await TitularModel.create({
      nombre: 'A Borrar',
      domicilio: 'Calle Eliminada 123',
      email: 'borrar@mail.com',
    });

    const res = await request(app)
      .delete(`/titulares/${titular._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Baja solicitada' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Titular eliminado exitosamente');

    const eliminado = await TitularModel.findById(titular._id);
    expect(eliminado).toBeNull();

    const log = await AuditLogModel.findOne({ entidad: 'Titular', accion: 'ELIMINACION' });
    expect(log).not.toBeNull();
    expect(log?.detalles?.datosAnteriores).toHaveProperty('nombre', 'A Borrar');
  });
});