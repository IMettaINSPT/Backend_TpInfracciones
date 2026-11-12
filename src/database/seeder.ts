import bcrypt from 'bcrypt';
import { PermisoModel } from '../models/Permiso';
import { PerfilModel } from '../models/Perfil';
import { UserModel } from '../models/User';
import { refrescarCachePermisos } from '../middleware/roleCheck';

export const CATALOGO_PERMISOS = [
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

  // Padrón
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

export const ejecutarSeeder = async () => {
  try {
    // 1. Sincronizamos permisos (crea los que falten sin duplicar)
    for (const item of CATALOGO_PERMISOS) {
      await PermisoModel.updateOne({ codigo: item.codigo }, { $setOnInsert: item }, { upsert: true });
    }
    await refrescarCachePermisos();

    const todosLosPermisos = await PermisoModel.find().lean();
    const idsPorCodigo = (codigos: string[]) =>
      todosLosPermisos.filter((p) => codigos.includes(p.codigo)).map((p) => p._id);

    // 2. Creamos los 3 perfiles base si no existen
    let perfilAdmin = await PerfilModel.findOne({ nombre: 'Admin del Sistema' });
    if (!perfilAdmin) {
      perfilAdmin = await PerfilModel.create({
        nombre: 'Admin del Sistema',
        descripcion: 'Acceso total al sistema y configuración',
        permisos: todosLosPermisos.map((p) => p._id),
        esSistema: true,
      });
    }

    const existeAdminis = await PerfilModel.findOne({ nombre: 'Administrativo' });
    if (!existeAdminis) {
      await PerfilModel.create({
        nombre: 'Administrativo',
        descripcion: 'Gestión de oficina, caja, descargos y padrón',
        permisos: idsPorCodigo([
          'panel:ver',
          'deuda:consultar',
          'infraccion:ver',
          'infraccion:descargo',
          'pago:crear',
          'pago:ver',
          'titular:ver',
          'titular:gestionar',
          'vehiculo:ver_patente',
          'vehiculo:ver',
          'vehiculo:gestionar',
        ]),
        esSistema: true,
      });
    }

    const existeInspector = await PerfilModel.findOne({ nombre: 'Inspector' });
    if (!existeInspector) {
      await PerfilModel.create({
        nombre: 'Inspector',
        descripcion: 'Operativo en vía pública y labrado de actas',
        permisos: idsPorCodigo(['infraccion:crear', 'vehiculo:ver_patente']),
        esSistema: true,
      });
    }

    // 3. Creamos el usuario Admin inicial si no existe
    const seedEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@infracciones.gob.ar').trim().toLowerCase();
    const seedPass = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';

    const adminExistente = await UserModel.findOne({ email: seedEmail });
    if (!adminExistente) {
      const hashedPassword = await bcrypt.hash(seedPass, 10);
      await UserModel.create({
        email: seedEmail,
        password: hashedPassword,
        nombre: 'Administrador General',
        perfilId: perfilAdmin._id,
      });
      console.log(`[Seeder] Usuario administrador creado: ${seedEmail}`);
    }
  } catch (error) {
    console.error('[Seeder] Error al inicializar datos base:', error);
  }
};