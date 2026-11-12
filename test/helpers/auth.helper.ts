import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../../src/models/User';
import { PerfilModel } from '../../src/models/Perfil';
import { PermisoModel } from '../../src/models/Permiso';
import { refrescarCachePermisos } from '../../src/middleware/roleCheck';

export interface TestAuthContext {
  adminToken: string;
  administrativoToken: string;
  inspectorToken: string;
  adminId: string;
  administrativoId: string;
  inspectorId: string;
  adminPerfilId: string;
  administrativoPerfilId: string;
  inspectorPerfilId: string;
  permisosMap: Record<string, string>; // codigo -> _id.toString() 
}

const CATALOGO_PERMISOS_BASE = [
  // Panel y Deudas
  { codigo: 'panel:ver', nombre: 'Ver panel de control', modulo: 'Panel' },
  { codigo: 'deuda:consultar', nombre: 'Consultar deudas por patente/titular', modulo: 'Panel' },

  // Infracciones
  { codigo: 'infraccion:crear', nombre: 'Labrar actas de infracción', modulo: 'Infracciones' },
  { codigo: 'infraccion:ver', nombre: 'Listar y ver detalle de actas', modulo: 'Infracciones' },
  { codigo: 'infraccion:descargo', nombre: 'Registrar descargos', modulo: 'Infracciones' },
  { codigo: 'infraccion:anular', nombre: 'Anular actas de infracción', modulo: 'Infracciones' },

  // Pagos
  { codigo: 'pago:crear', nombre: 'Registrar cobros de actas', modulo: 'Pagos' },
  { codigo: 'pago:ver', nombre: 'Ver comprobantes e historial de pagos', modulo: 'Pagos' },
  { codigo: 'pago:anular', nombre: 'Anular pagos registrados', modulo: 'Pagos' },

  // Padrón (Titulares y Vehículos)
  { codigo: 'titular:ver', nombre: 'Consultar padrón de titulares', modulo: 'Padrón' },
  { codigo: 'titular:gestionar', nombre: 'Crear, editar y desvincular titulares', modulo: 'Padrón' },
  { codigo: 'titular:eliminar', nombre: 'Eliminar titulares sin rodados', modulo: 'Padrón' },
  { codigo: 'vehiculo:ver_patente', nombre: 'Consultar rodado y titulares por patente', modulo: 'Padrón' },
  { codigo: 'vehiculo:ver', nombre: 'Consultar listado y detalle de vehículos', modulo: 'Padrón' },
  { codigo: 'vehiculo:gestionar', nombre: 'Crear, editar y asociar vehículos', modulo: 'Padrón' },

  // Administración y Auditoría
  { codigo: 'usuarios:gestionar', nombre: 'Administrar usuarios del sistema', modulo: 'Administración' },
  { codigo: 'perfiles:gestionar', nombre: 'Administrar perfiles y permisos', modulo: 'Administración' },
  { codigo: 'auditoria:ver', nombre: 'Consultar logs de auditoría', modulo: 'Auditoría' },
];

export const setupTestAuth = async (): Promise<TestAuthContext> => {
  const JWT_SECRET = process.env.JWT_SECRET || 'secreto_testing_123';
  const salt = await bcrypt.hash('Password123!', 10);
  const seedEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').toLowerCase();

  // 1. Insertamos los permisos atómicos en la DB en memoria e hidratamos la caché del middleware
  const permisosDocs = await PermisoModel.insertMany(CATALOGO_PERMISOS_BASE);
  await refrescarCachePermisos();

  const permisosMap: Record<string, string> = {};
  permisosDocs.forEach((p) => {
    permisosMap[p.codigo] = p._id.toString();
  });

  const idsPorCodigo = (codigos: string[]) =>
    permisosDocs.filter((p) => codigos.includes(p.codigo)).map((p) => p._id);

  // 2. Creamos los 3 perfiles base referenciando los ObjectId de Permiso
  const [perfilAdmin, perfilAdministrativo, perfilInspector] = await Promise.all([
    PerfilModel.create({
      nombre: 'Admin del Sistema',
      descripcion: 'Acceso total al sistema y configuración',
      permisos: permisosDocs.map((p) => p._id),
      esSistema: true,
    }),
    PerfilModel.create({
      nombre: 'Administrativo',
      descripcion: 'Gestión de oficina, caja, descargos y padrón',
      permisos: idsPorCodigo([
        'panel:ver',
        'deuda:consultar',
        'infraccion:ver',
        'infraccion:descargo',
        'infraccion:anular',
        'pago:crear',
        'pago:ver',
        'titular:ver',
        'titular:gestionar',
        'vehiculo:ver_patente',
        'vehiculo:ver',
        'vehiculo:gestionar',
      ]),
      esSistema: true,
    }),
    PerfilModel.create({
      nombre: 'Inspector',
      descripcion: 'Operativo en vía pública y labrado de actas',
      permisos: idsPorCodigo([
        'infraccion:crear',
        'vehiculo:ver_patente',
      ]),
      esSistema: true,
    }),
  ]);

  // 3. Creamos los 3 usuarios vinculando su perfilId
  const [adminUser, administrativoUser, inspectorUser] = await Promise.all([
    UserModel.create({
      email: seedEmail,
      password: salt,
      perfilId: perfilAdmin._id,
      nombre: 'Administrador General',
    }),
    UserModel.create({
      email: 'administrativo@infracciones.gob.ar',
      password: salt,
      perfilId: perfilAdministrativo._id,
      nombre: 'Personal Mesa de Entrada',
    }),
    UserModel.create({
      email: 'inspector.calle@infracciones.gob.ar',
      password: salt,
      perfilId: perfilInspector._id,
      nombre: 'Inspector de Tránsito',
    }),
  ]);

  // 4. Firmamos los tokens JWT incluyendo los ObjectIds de permisos serializados
  const adminToken = jwt.sign(
    {
      id: adminUser._id.toString(),
      email: adminUser.email,
      perfilId: perfilAdmin._id.toString(),
      permisos: perfilAdmin.permisos.map((id) => id.toString()),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const administrativoToken = jwt.sign(
    {
      id: administrativoUser._id.toString(),
      email: administrativoUser.email,
      perfilId: perfilAdministrativo._id.toString(),
      permisos: perfilAdministrativo.permisos.map((id) => id.toString()),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const inspectorToken = jwt.sign(
    {
      id: inspectorUser._id.toString(),
      email: inspectorUser.email,
      perfilId: perfilInspector._id.toString(),
      permisos: perfilInspector.permisos.map((id) => id.toString()),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return {
    adminToken,
    administrativoToken,
    inspectorToken,
    adminId: adminUser._id.toString(),
    administrativoId: administrativoUser._id.toString(),
    inspectorId: inspectorUser._id.toString(),
    adminPerfilId: perfilAdmin._id.toString(),
    administrativoPerfilId: perfilAdministrativo._id.toString(),
    inspectorPerfilId: perfilInspector._id.toString(),
    permisosMap,
  };
};