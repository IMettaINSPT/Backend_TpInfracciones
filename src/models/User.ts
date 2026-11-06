import { Schema, model, InferSchemaType } from 'mongoose';

const userSchema = new Schema({
    email: {
        type: String, required: true,unique: true, trim: true,lowercase: true
    },
    password: {
        type: String,required: true
    },
    role: {
        type: String, required: true,enum: ['inspector', 'administrativo', 'admin'] 
    },
    nombre: {
        type: String, required: true,trim: true
    }
}, {
    timestamps: true // Genera automáticamente createdAt y updatedAt
});

// Extraemos el tipo de TypeScript directamente desde el esquema
export type User = InferSchemaType<typeof userSchema>;

// Compilamos el modelo
export const UserModel = model('User', userSchema);