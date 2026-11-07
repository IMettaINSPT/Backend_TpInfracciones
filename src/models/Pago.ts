// src/models/Pago.ts
import { Schema, model, InferSchemaType } from 'mongoose';

const pagadorSchema = new Schema(
  {
    nombreCompleto: { type: String, required: true, trim: true },
    dniCuit: { type: String, required: true, trim: true },
    telefono: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const tarjetaSchema = new Schema(
  {
    tipoTarjeta: { type: String, required: true, enum: ['credito', 'debito'] },
    emisor: { type: String, required: true, enum: ['visa', 'mastercard', 'amex', 'cabal', 'otro'] },
    nombreTitular: { type: String, required: true, trim: true },
    ultimos4Digitos: { type: String, required: true, trim: true },
    mesExpiracion: { type: String, required: true, trim: true },
    anioExpiracion: { type: String, required: true, trim: true },
    codigoAutorizacion: { type: String, trim: true },
  },
  { _id: false }
);

const pagoSchema = new Schema(
  {
    numeroComprobante: { type: String, required: true, unique: true, uppercase: true, trim: true },
    infracciones: [{ type: Schema.Types.ObjectId, ref: 'Infraccion', required: true }],
    montoTotalAbonado: { type: Number, required: true, min: 0.01 },
    medioPago: { type: String, required: true, enum: ['contado', 'tarjeta'] },
    datosTarjeta: { type: tarjetaSchema },
    pagador: { type: pagadorSchema, required: true },
    cajero: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fechaPago: { type: Date, required: true, default: Date.now },
    // Gestión de anulación administrativa
    estado: { type: String, required: true, enum: ['completado', 'anulado'], default: 'completado' },
    motivoAnulacion: { type: String, trim: true },
    fechaAnulacion: { type: Date },
    anuladoPor: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

pagoSchema.index({ infracciones: 1 });
pagoSchema.index({ estado: 1 });

export type Pago = InferSchemaType<typeof pagoSchema>;
export const PagoModel = model('Pago', pagoSchema);