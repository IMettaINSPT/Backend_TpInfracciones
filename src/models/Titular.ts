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
      sparse: true,
      trim: true,
      // Validación: Si es persona jurídica, el CUIT es obligatorio
      validate: {
        validator: function (this: any, val: string) {
          if (this.esPersonaJuridica) {
            return typeof val === 'string' && val.trim().length > 0;
          }
          return true;
        },
        message: 'El CUIT es obligatorio para personas jurídicas',
      },
    },
    nombre: {
      type: String,
      required: [true, 'El nombre o razón social es obligatorio'],
      trim: true,
    },
    apellido: {
      type: String,
      trim: true,
      // Validación: Si es persona física, el apellido es obligatorio
      validate: {
        validator: function (this: any, val: string) {
          if (!this.esPersonaJuridica) {
            return typeof val === 'string' && val.trim().length > 0;
          }
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
      // Validación: Si es persona física, el DNI es obligatorio
      validate: {
        validator: function (this: any, val: string) {
          if (!this.esPersonaJuridica) {
            return typeof val === 'string' && val.trim().length > 0;
          }
          return true;
        },
        message: 'El DNI es obligatorio para personas físicas',
      },
    },
    domicilio: {
      type: String,
      required: [true, 'El domicilio legal es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El email de contacto es obligatorio'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'El formato de email no es válido'],
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

// Índices para optimizar búsquedas operativas
titularSchema.index({ email: 1 });
titularSchema.index({ nombre: 1, apellido: 1 });

// Trae todos los vehículos vinculados históricamente
titularSchema.virtual('vehiculos', {
  ref: 'Vehiculo',
  localField: '_id',
  foreignField: 'titulares.titular',
});

// Trae exclusivamente los vehículos donde el titular está ACTIVO (sin fecha de baja)
titularSchema.virtual('vehiculosActivos', {
  ref: 'Vehiculo',
  localField: '_id',
  foreignField: 'titulares.titular',
  match: { 'titulares.fechaBajaRegistro': { $exists: false } },
});

// Configuración para serializar los virtuals en respuestas JSON
titularSchema.set('toObject', { virtuals: true });
titularSchema.set('toJSON', { virtuals: true });

export type Titular = InferSchemaType<typeof titularSchema>;
export const TitularModel = model('Titular', titularSchema);