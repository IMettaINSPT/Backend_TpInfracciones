// src/models/Titular.ts
import { Schema, model, InferSchemaType } from 'mongoose';

const titularSchema = new Schema(
  {
    esPersonaJuridica: {
      type: Boolean,
      required: true,
      default: false,
    },
    cuit: {
      type: String,
      unique: true,
      sparse: true, // <-- Fundamental para que permita múltiples titulares sin CUIT
      trim: true,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    apellido: {
      type: String,
      trim: true,
    },
    dni: {
      type: String,
      trim: true,
    },
    domicilio: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    telefono: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export type Titular = InferSchemaType<typeof titularSchema>;

export const TitularModel = model('Titular', titularSchema);