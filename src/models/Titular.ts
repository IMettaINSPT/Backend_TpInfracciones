import { Schema, model } from 'mongoose';
import { ITitular } from '../types';

const titularSchema = new Schema<ITitular>(
  {
    esPersonaJuridica: { type: Boolean, required: true, default: false },
    cuit: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function (this: any, val: string) {
          if (this.esPersonaJuridica) return typeof val === 'string' && val.trim().length > 0;
          return true;
        },
        message: 'El CUIT es obligatorio para personas jurídicas',
      },
    },
    nombre: { type: String, required: [true, 'El nombre o razón social es obligatorio'], trim: true },
    apellido: {
      type: String,
      trim: true,
      validate: {
        validator: function (this: any, val: string) {
          if (!this.esPersonaJuridica) return typeof val === 'string' && val.trim().length > 0;
          return true;
        },
        message: 'El apellido es obligatorio para personas físicas',
      },
    },
    dni: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function (this: any, val: string) {
          if (!this.esPersonaJuridica) return typeof val === 'string' && val.trim().length > 0;
          return true;
        },
        message: 'El DNI es obligatorio para personas físicas',
      },
    },
    domicilio: { type: String, required: [true, 'El domicilio legal es obligatorio'], trim: true },
    email: {
      type: String,
      required: [true, 'El email de contacto es obligatorio'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'El formato de email no es válido'],
    },
    telefono: { type: String, trim: true },
  },
  { timestamps: true }
);

titularSchema.index({ email: 1 });
titularSchema.index({ nombre: 1, apellido: 1 });

titularSchema.virtual('vehiculos', {
  ref: 'Vehiculo',
  localField: '_id',
  foreignField: 'titulares.titular',
});

titularSchema.virtual('vehiculosActivos', {
  ref: 'Vehiculo',
  localField: '_id',
  foreignField: 'titulares.titular',
  match: { 'titulares.fechaBajaRegistro': { $exists: false } },
});

titularSchema.set('toObject', { virtuals: true });
titularSchema.set('toJSON', { virtuals: true });

export const TitularModel = model<ITitular>('Titular', titularSchema);