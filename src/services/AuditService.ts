// src/services/AuditService.ts
import { AuditLogModel } from '../models/AuditLog';

export type EntidadAuditable = 'Usuario' | 'User' | 'Titular' | 'Vehiculo' | 'Infraccion';
export type AccionAuditable = 'CREACION' | 'MODIFICACION' | 'ELIMINACION' | 'CAMBIO_ESTADO';

export interface RegistrarAuditoriaParams {
  entidad: EntidadAuditable;
  entidadId: string;
  accion: AccionAuditable;
  usuarioId: any;
  datosAnteriores?: any;
  datosNuevos?: any;
  motivo?: string;
  ip?: string;
}

export const registrarAuditoria = async (data: RegistrarAuditoriaParams) => {
  try {
    const idFinal = data.usuarioId?.id || data.usuarioId?._id || data.usuarioId;

    if (!idFinal) {
      console.warn('[Auditoría] No se pudo registrar: usuarioId no provisto.');
      return;
    }

    await AuditLogModel.create({
      ...data,
      usuarioId: idFinal,
    });
  } catch (error) {
    console.error('[Error de Auditoría] No se pudo guardar el snapshot:', error);
  }
};