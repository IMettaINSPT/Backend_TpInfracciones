import { Schema, model } from 'mongoose';
import { IInfraccion } from '../types';

const infraccionSchema = new Schema<IInfraccion>(
  {
    numeroActa: { type: String, required: true, unique: true, uppercase: true, trim: true },
    codigoBarras: { type: String, required: true, unique: true, trim: true },
    vehiculo: { type: Schema.Types.ObjectId, ref: 'Vehiculo', required: true },
    tipoFalta: { type: String, required: true, trim: true },
    lugar: { type: String, required: true, trim: true },
    fechaHora: { type: Date, required: true, default: Date.now },
    fechaPago: { type: Date },
    monto: { type: Number, required: true, min: 0 },
    estado: {
      type: String,
      required: true,
      enum: ['pendiente', 'notificada', 'pagada', 'en descargo', 'anulada'],
      default: 'pendiente',
    },
    inspector: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    motivoDescargo: { type: String, trim: true },
  },
  { timestamps: true }
);

infraccionSchema.index({ vehiculo: 1 });
infraccionSchema.index({ estado: 1 });

export const InfraccionModel = model<IInfraccion>('Infraccion', infraccionSchema);