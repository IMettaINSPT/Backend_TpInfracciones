import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { VehiculoModel } from '../models/Vehiculo';
import { TitularModel } from '../models/Titular';
import { InfraccionModel } from '../models/Infraccion';
import { registrarAuditoria } from '../services/AuditService';

export const createVehiculo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patente, marca, modelo, anio, titulares } = req.body || {};

    if (!patente || !marca || !modelo || !anio) {
      return res.status(400).json({ error: 'Patente, marca, modelo y año son obligatorios' });
    }

    const patenteNormalizada = patente.trim().toUpperCase();
    const existePatente = await VehiculoModel.findOne({ patente: patenteNormalizada });
    if (existePatente) {
      return res.status(400).json({ error: 'Ya existe un vehículo registrado con esa patente' });
    }

    // Validar titulares si vienen definidos en el payload inicial
    const titularesProcesados = [];
    if (Array.isArray(titulares) && titulares.length > 0) {
      for (const t of titulares) {
        if (!t.titular || !isValidObjectId(t.titular)) {
          return res.status(400).json({ error: 'ID de titular inválido en la lista' });
        }
        const existeTitular = await TitularModel.findById(t.titular);
        if (!existeTitular) {
          return res.status(404).json({ error: `El titular con ID ${t.titular} no existe` });
        }
        titularesProcesados.push({
          titular: t.titular,
          porcentajeTitularidad: t.porcentajeTitularidad || 100,
          fechaAltaRegistro: new Date(),
        });
      }
    }

    const nuevoVehiculo = await VehiculoModel.create({
      patente: patenteNormalizada,
      marca: marca.trim(),
      modelo: modelo.trim(),
      anio: Number(anio),
      titulares: titularesProcesados,
    });

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Vehiculo' as any,
        entidadId: nuevoVehiculo._id.toString(),
        accion: 'CREACION',
        usuarioId: req.user.id,
        datosNuevos: nuevoVehiculo.toObject(),
        motivo: `Alta de vehículo dominio ${patenteNormalizada}`,
        ip: req.ip,
      });
    }

    res.status(201).json({
      message: 'Vehículo registrado exitosamente',
      vehiculo: nuevoVehiculo,
    });
  } catch (error) {
    next(error);
  }
};

export const getVehiculos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { busqueda, marca } = req.query;
    const filtro: Record<string, any> = {};

    if (marca && typeof marca === 'string') {
      filtro.marca = { $regex: marca.trim(),$options: 'i' };
    }

    if (busqueda && typeof busqueda === 'string') {
      filtro.$or = [
        { patente: { $regex: busqueda.trim().toUpperCase(),$options: 'i' } },
        { modelo: { $regex: busqueda.trim(),$options: 'i' } },
      ];
    }

    const vehiculos = await VehiculoModel.find(filtro)
      .populate('titulares.titular', 'nombre apellido dni cuit esPersonaJuridica email')
      .sort({ createdAt: -1 });

    res.json(vehiculos);
  } catch (error) {
    next(error);
  }
};

export const getVehiculoByPatente = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patente } = req.params as { patente: string };

    if (!patente || patente.trim() === '') {
      return res.status(400).json({ error: 'Debe ingresar una patente válida' });
    }

    const vehiculo = await VehiculoModel.findOne({ patente: patente.trim().toUpperCase() })
      .populate({
        path: 'titulares.titular',
        select: 'nombre apellido dni cuit esPersonaJuridica domicilio email telefono',
      });

    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado para la patente especificada' });
    }

    const vehiculoObj = vehiculo.toObject();
    
    // Filtramos titulares que están vigentes (sin fecha de baja)
    const titularesVigentes = (vehiculoObj.titulares || []).filter(
      (item: any) => !item.fechaBajaRegistro
    );

    res.json({
      ...vehiculoObj,
      titularesVigentes,
    });
  } catch (error) {
    next(error);
  }
};

export const getVehiculoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const vehiculo = await VehiculoModel.findById(id).populate({
      path: 'titulares.titular',
      select: 'nombre apellido dni cuit esPersonaJuridica domicilio email telefono',
    });

    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    res.json(vehiculo);
  } catch (error) {
    next(error);
  }
};

export const updateVehiculo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const vehiculo = await VehiculoModel.findById(id);
    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const snapshotAnterior = vehiculo.toObject();
    const { marca, modelo, anio } = req.body || {};

    if (marca) vehiculo.marca = marca.trim();
    if (modelo) vehiculo.modelo = modelo.trim();
    if (anio) vehiculo.anio = Number(anio);

    await vehiculo.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Vehiculo' as any,
        entidadId: id,
        accion: 'MODIFICACION',
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: vehiculo.toObject(),
        motivo: `Actualización de datos del vehículo ${vehiculo.patente}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Vehículo actualizado exitosamente', vehiculo });
  } catch (error) {
    next(error);
  }
};

export const addTitularVehiculo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { titularId, porcentajeTitularidad } = req.body || {};

    if (!isValidObjectId(id) || !isValidObjectId(titularId)) {
      return res.status(400).json({ error: 'IDs de vehículo o titular inválidos' });
    }

    const [vehiculo, titular] = await Promise.all([
      VehiculoModel.findById(id),
      TitularModel.findById(titularId),
    ]);

    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (!titular) return res.status(404).json({ error: 'Titular no encontrado' });

    // Verificar si ya figura activo
    const yaEsTitularVigente = vehiculo.titulares.some(
      (t: any) => t.titular.toString() === titularId && !t.fechaBajaRegistro
    );

    if (yaEsTitularVigente) {
      return res.status(400).json({ error: 'El titular ya se encuentra asignado y vigente en este vehículo' });
    }

    const snapshotAnterior = vehiculo.toObject();

    vehiculo.titulares.push({
      titular: titular._id,
      porcentajeTitularidad: porcentajeTitularidad ? Number(porcentajeTitularidad) : 100,
      fechaAltaRegistro: new Date(),
    } as any);

    await vehiculo.save();

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Vehiculo' as any,
        entidadId: id,
        accion: 'MODIFICACION',
        usuarioId: req.user.id,
        datosAnteriores: snapshotAnterior,
        datosNuevos: vehiculo.toObject(),
        motivo: `Asignación de titular ${titular.nombre} al vehículo ${vehiculo.patente}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Titular asignado exitosamente', vehiculo });
  } catch (error) {
    next(error);
  }
};

export const deleteVehiculo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Regla de integridad de negocio: no eliminar si tiene actas labradas
    const actasAsociadas = await InfraccionModel.countDocuments({ vehiculo: id });
    if (actasAsociadas > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar el vehículo: posee actas de infracción asociadas en el sistema',
      });
    }

    const vehiculo = await VehiculoModel.findByIdAndDelete(id);
    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    if (req.user?.id) {
      await registrarAuditoria({
        entidad: 'Vehiculo' as any,
        entidadId: id,
        accion: 'ELIMINACION',
        usuarioId: req.user.id,
        datosAnteriores: vehiculo.toObject(),
        motivo: `Baja de vehículo patente ${vehiculo.patente}`,
        ip: req.ip,
      });
    }

    res.json({ message: 'Vehículo eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
};