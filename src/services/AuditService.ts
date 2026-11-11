import { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog';
import { RegistrarAuditoriaParams } from '../types';

export const registrarAuditoria = async (data: RegistrarAuditoriaParams): Promise<void> => {
  try {
    if (!data.usuarioId || !(data.usuarioId instanceof Types.ObjectId)) {
      console.warn('[Auditoría] No se pudo registrar: usuarioId no es un ObjectId válido.');
      return;
    }

    await AuditLogModel.create({
      entidad: data.entidad,
      entidadId: data.entidadId,
      accion: data.accion,
      usuarioId: data.usuarioId,
      datosAnteriores: data.datosAnteriores,
      datosNuevos: data.datosNuevos,
      motivo: data.motivo,
      ip: data.ip || 'N/A',
    });
  } catch (error) {
    console.error('[Error de Auditoría] No se pudo guardar el snapshot:', error);
  }
};