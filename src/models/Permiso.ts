import { Schema, model } from 'mongoose';
import { IPermiso } from '../types';

const permisoSchema = new Schema<IPermiso>(
  {
    codigo: { type: String, required: true, unique: true, trim: true }, // ej: "infraccion:anular" (para lookup interno)
    nombre: { type: String, required: true, trim: true },               // ej: "Anular actas de infracción" (para la UI)
    modulo: { type: String, required: true, trim: true },               // ej: "Infracciones", "Pagos", "Padrón", "Usuarios"
    descripcion: { type: String, trim: true },
  },
  { timestamps: true }
);

export const PermisoModel = model<IPermiso>('Permiso', permisoSchema);