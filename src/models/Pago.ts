// src/models/Pago.ts
import { Schema, model } from 'mongoose';
import { IPago, IDatosTarjeta, IDatosBilletera, IPagador } from '../types';

// esquema tarjeta
const tarjetaSchema = new Schema<IDatosTarjeta>(
  {
    tipoTarjeta: { type: String, required: true, enum: ['credito', 'debito'] },
    emisor: { type: String, required: true, enum: ['visa', 'mastercard', 'amex', 'cabal', 'otro'] },
    nombreTitular: { type: String, required: true, trim: true },
    ultimos4Digitos: { type: String, required: true, minlength: 4, maxlength: 4 },
    mesExpiracion: { type: String, required: true },
    anioExpiracion: { type: String, required: true },
    codigoAutorizacion: { type: String, trim: true },
  },
  { _id: false }
);

// esquema billetera 
const billeteraSchema = new Schema<IDatosBilletera>(
  {
    proveedor: { type: String, required: true, enum: ['mercadopago', 'modo', 'uala', 'cuenta_dni', 'otro'] },
    idTransaccionExterna: { type: String, required: true, trim: true },
    estadoTransaccion: { type: String, default: 'approved' },
    detalleEstado: { type: String },
    tipoPago: { type: String },
    montoNetoRecibido: { type: Number },
    comisionPasarela: { type: Number },
    fechaAprobacionExterna: { type: Date, default: Date.now },
    emailPagadorPasarela: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

//  esquema pagador
const pagadorSchema = new Schema<IPagador>(
  {
    nombreCompleto: { type: String, required: true, trim: true },
    dniCuit: { type: String, required: true, trim: true },
    telefono: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

// esquema pago
const pagoSchema = new Schema<IPago>(
  {
    numeroComprobante: { type: String, required: true, unique: true, uppercase: true, trim: true },
    infracciones: [{ type: Schema.Types.ObjectId, ref: 'Infraccion', required: true }],
    montoTotalAbonado: { type: Number, required: true, min: 0.01 },
    medioPago: { type: String, required: true, enum: ['tarjeta', 'billetera_virtual'] },
    datosTarjeta: { type: tarjetaSchema, required: false },
    datosBilletera: { type: billeteraSchema, required: false },
    pagador: { type: pagadorSchema, required: true },
    cajero: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fechaPago: { type: Date, required: true, default: Date.now },
    estado: {
      type: String, required: true, enum: ['completado', 'anulado'], default: 'completado',
    },
    motivoAnulacion: { type: String, trim: true },
    fechaAnulacion: { type: Date },
    anuladoPor: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

export const PagoModel = model<IPago>('Pago', pagoSchema);