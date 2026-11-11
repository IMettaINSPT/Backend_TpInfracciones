// src/types.ts
import { Types } from 'mongoose';

// ==========================================
// 1. Roles y Autenticación
// ==========================================
export type Role = 'inspector' | 'administrativo' | 'admin';

export interface UserTokenPayload {
  id: string; // En el token JWT viaja serializado como string
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

export interface IUser {
  _id?: Types.ObjectId;
  email: string;
  password?: string;
  role: Role;
  nombre: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ==========================================
// 2. Entidad Titular
// ==========================================
export interface ITitular {
  _id?: Types.ObjectId;
  esPersonaJuridica: boolean;
  cuit?: string;
  nombre: string;
  apellido?: string;
  dni?: string;
  domicilio: string;
  email: string;
  telefono?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ==========================================
// 3. Entidad Vehículo
// ==========================================
export interface ITitularVinculado {
  titular: Types.ObjectId; 
  porcentajeTitularidad: number;
  fechaAltaRegistro: Date;
  fechaBajaRegistro?: Date;
}

export interface IVehiculo {
  _id?: Types.ObjectId;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  titulares: ITitularVinculado[];
  createdAt?: Date;
  updatedAt?: Date;
}

// ==========================================
// 4. Entidad Infracción
// ==========================================
export type InfraccionEstado = 'pendiente' | 'notificada' | 'pagada' | 'en descargo' | 'anulada';

export interface IInfraccion {
  _id?: Types.ObjectId;
  numeroActa: string;
  codigoBarras: string;
  vehiculo: Types.ObjectId; 
  tipoFalta: string;
  lugar: string;
  fechaHora: Date;
  fechaPago?: Date;
  monto: number;
  estado: InfraccionEstado;
  inspector: Types.ObjectId; 
  motivoDescargo?: string;
  urlPago?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ==========================================
// 5. Entidad Pago
// ==========================================
export type TipoTarjeta = 'credito' | 'debito';
export type EmisorTarjeta = 'visa' | 'mastercard' | 'amex' | 'cabal' | 'otro';
export type PagoEstado = 'completado' | 'anulado';
export type MedioPago = 'tarjeta' | 'billetera_virtual';
export type ProveedorBilletera = 'mercadopago' | 'modo' | 'uala' | 'cuenta_dni' | 'otro';

export interface IPagador {
  nombreCompleto: string;
  dniCuit: string;
  telefono?: string;
  email?: string;
}

export interface IDatosTarjeta {
  tipoTarjeta: TipoTarjeta;
  emisor: EmisorTarjeta;
  nombreTitular: string;
  ultimos4Digitos: string;
  mesExpiracion: string;
  anioExpiracion: string;
  codigoAutorizacion?: string;
}

export interface IDatosBilletera {
  proveedor: ProveedorBilletera;
  idTransaccionExterna: string;
  estadoTransaccion: string;
  detalleEstado?: string;
  tipoPago?: string;
  montoNetoRecibido?: number;
  comisionPasarela?: number;
  fechaAprobacionExterna?: Date;
  emailPagadorPasarela?: string;
}

export interface IPago {
  _id?: Types.ObjectId;
  numeroComprobante: string;
  infracciones: Types.ObjectId[];
  montoTotalAbonado: number;
  medioPago: MedioPago;
  
  // Exclusivos según medioPago
  datosTarjeta?: IDatosTarjeta;
  datosBilletera?: IDatosBilletera;
  
  pagador: IPagador;
  cajero: Types.ObjectId;
  fechaPago: Date;
  estado: PagoEstado;
  motivoAnulacion?: string;
  fechaAnulacion?: Date;
  anuladoPor?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Tipo específico para cuando se ejecuta .populate() en las lecturas
export type PagoCompleto = Omit<IPago, 'infracciones' | 'cajero' | 'anuladoPor'> & {
  infracciones: IInfraccion[];
  cajero: IUser;
  anuladoPor?: IUser;
};
// ==========================================
// 6. Auditoría
// ==========================================
export type EntidadAuditable = 'Usuario' | 'User' | 'Titular' | 'Vehiculo' | 'Infraccion' | 'Pago';
export type AccionAuditoria = 'CREACION' | 'MODIFICACION' | 'ELIMINACION' | 'CAMBIO_ESTADO';

export interface IAuditLog {
  _id?: Types.ObjectId;
  entidad: EntidadAuditable;
  entidadId: string;           // Se mantiene string para admitir IDs normalizados en logs
  accion: AccionAuditoria;
  usuarioId: Types.ObjectId; 
  datosAnteriores?: object | null;
  datosNuevos?: object | null;
  motivo?: string;
  ip?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RegistrarAuditoriaParams {
  entidad: EntidadAuditable;
  entidadId: string;
  accion: AccionAuditoria;
  usuarioId: Types.ObjectId; 
  datosAnteriores?: object | null;
  datosNuevos?: object | null;
  motivo?: string;
  ip?: string;
}

// ==========================================
// 7. Panel y Métricas
// ==========================================
export interface IFiltroPeriodo {
  fechaDesde?:  Date;
  fechaHasta?:  Date;
}