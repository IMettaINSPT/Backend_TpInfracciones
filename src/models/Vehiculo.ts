import { Schema, model, InferSchemaType } from 'mongoose';

// relacion vehiculo-titular
const titularVinculadoSchema = new Schema(
  {
    titular: {
      type: Schema.Types.ObjectId,
      ref: 'Titular',
      required: [true, 'El ID del titular es obligatorio'],
    },
    porcentajeTitularidad: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
      max: 100,
    },
    fechaAltaRegistro: {
      type: Date,
      required: true,
      default: Date.now, 
    },
    fechaBajaRegistro: {
      type: Date, 
    },
  },
  { _id: false }
);

const vehiculoSchema = new Schema(
  {
    patente: {
      type: String,
      required: [true, 'La patente es obligatoria'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    marca: { type: String, required: true, trim: true },
    modelo: { type: String, required: true, trim: true },
    anio: { type: Number, required: true, min: 1980 },
    titulares: [titularVinculadoSchema], // aca residen fechaAltaRegistro y fechaBajaRegistro
  },
  { timestamps: true }
);

export type Vehiculo = InferSchemaType<typeof vehiculoSchema>;
export const VehiculoModel = model('Vehiculo', vehiculoSchema);