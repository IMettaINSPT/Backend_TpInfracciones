import { Schema, model, InferSchemaType } from 'mongoose';

const auditLogSchema = new Schema(
  {
    entidad: { type: String, required: true, enum: ['Titular', 'Vehiculo', 'Infraccion', 'Pago', 'User'] },
    entidadId: { type: Schema.Types.ObjectId, required: true },
    accion: { type: String, required: true, enum: ['CREACION', 'MODIFICACION', 'ELIMINACION', 'CAMBIO_ESTADO', 'LECTURA'] }, usuario: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    detalles: {
      datosAnteriores: { type: Schema.Types.Mixed },
      datosNuevos: { type: Schema.Types.Mixed },
      motivo: { type: String, trim: true },
    },
    ip: { type: String, default: 'N/A' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel = model('AuditLog', auditLogSchema);