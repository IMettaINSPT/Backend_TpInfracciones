import { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog';

interface RegistrarAuditoriaParams {
  entidad: 'Titular' | 'Vehiculo' | 'Infraccion' | 'Pago' | 'User';
  entidadId: Types.ObjectId | string;
  accion: 'CREACION' | 'MODIFICACION' | 'ELIMINACION' | 'CAMBIO_ESTADO';
  usuarioId: Types.ObjectId | string;
  datosAnteriores?: any;
  datosNuevos?: any;
  motivo?: string;
  ip?: string;
}

export const registrarAuditoria = async ({
  entidad,
  entidadId,
  accion,
  usuarioId,
  datosAnteriores,
  datosNuevos,
  motivo,
  ip,
}: RegistrarAuditoriaParams): Promise<void> => {
  try {
    await AuditLogModel.create({
      entidad,
      entidadId,
      accion,
      usuario: usuarioId,
      detalles: { datosAnteriores, datosNuevos, motivo },
      ip: ip || 'N/A',
    });
  } catch (error) {
    console.error('[Error de Auditoría] No se pudo guardar el snapshot:', error);
  }
};