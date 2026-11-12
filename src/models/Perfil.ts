import { Schema, model } from 'mongoose';
import { IPerfil } from '../types';

const perfilSchema = new Schema<IPerfil>(
  {
    nombre: { type: String, required: true, unique: true, trim: true }, 
    descripcion: { type: String, trim: true },
    permisos: [{ type: Schema.Types.ObjectId, ref: 'Permiso' }],        
    esSistema: { type: Boolean, default: false },                       // Protege los 3 perfiles base contra borrado
  },
  { timestamps: true }
);

export const PerfilModel = model<IPerfil>('Perfil', perfilSchema);