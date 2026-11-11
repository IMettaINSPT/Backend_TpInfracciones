import { Schema, model } from 'mongoose';
import { IVehiculo, ITitularVinculado } from '../types';

const titularVinculadoSchema = new Schema<ITitularVinculado>(
  {
    titular: { type: Schema.Types.ObjectId, ref: 'Titular', required: [true, 'El ID del titular es obligatorio'] },
    porcentajeTitularidad: { type: Number, required: true, default: 100, min: 1, max: 100 },
    fechaAltaRegistro: { type: Date, required: true, default: Date.now },
    fechaBajaRegistro: { type: Date },
  },
  { _id: false }
);

const vehiculoSchema = new Schema<IVehiculo>(
  {
    patente: { type: String, required: [true, 'La patente es obligatoria'], unique: true, trim: true, uppercase: true },
    marca: { type: String, required: true, trim: true },
    modelo: { type: String, required: true, trim: true },
    anio: { type: Number, required: true, min: 1980 },
    titulares: [titularVinculadoSchema],
  },
  { timestamps: true }
);

export const VehiculoModel = model<IVehiculo>('Vehiculo', vehiculoSchema);