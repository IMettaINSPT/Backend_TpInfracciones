import { Schema, model } from 'mongoose';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['inspector', 'administrativo', 'admin'] },
    nombre: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const UserModel = model<IUser>('User', userSchema);