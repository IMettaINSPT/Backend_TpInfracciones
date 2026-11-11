import { Schema, model } from 'mongoose';
import { IAuditLog } from '../types';

const auditLogSchema = new Schema<IAuditLog>(
  {
    entidad: {
      type: String,
      required: true,
      enum: ['Usuario', 'User', 'Titular', 'Vehiculo', 'Infraccion', 'Pago'],
    },
    entidadId: { type: String, required: true, trim: true },
    accion: {
      type: String,
      required: true,
      enum: ['CREACION', 'MODIFICACION', 'ELIMINACION', 'CAMBIO_ESTADO'],
    },
    usuarioId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    datosAnteriores: { type: Schema.Types.Mixed },
    datosNuevos: { type: Schema.Types.Mixed },
    motivo: { type: String, trim: true },
    ip: { type: String, trim: true },
  },
  { timestamps: true }
);

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);